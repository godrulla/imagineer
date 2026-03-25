import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  localPath?: string;
  cdnUrl?: string;
  encryption?: boolean;
  compression?: boolean;
}

export interface StorageOptions {
  encryption?: boolean;
  compression?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write';
  expires?: Date;
}

export interface StorageResult {
  key: string;
  url: string;
  size: number;
  hash: string;
  contentType: string;
  metadata?: Record<string, string>;
  provider: string;
  bucket?: string;
  cdnUrl?: string;
}

export interface StorageListResult {
  files: {
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
    contentType?: string;
  }[];
  totalSize: number;
  truncated: boolean;
  nextContinuationToken?: string;
}

export class StorageManager {
  private config: StorageConfig;
  private s3Client?: AWS.S3;
  private initialized = false;

  constructor(config?: StorageConfig) {
    this.config = {
      provider: 'local',
      localPath: './storage',
      encryption: false,
      compression: false,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 's3':
          await this.initializeS3();
          break;
        case 'local':
          await this.initializeLocal();
          break;
        default:
          throw new Error(`Unsupported storage provider: ${this.config.provider}`);
      }
      
      this.initialized = true;
      logger.info('Storage Manager initialized', { 
        provider: this.config.provider,
        bucket: this.config.bucket,
        region: this.config.region 
      });
    } catch (error) {
      logger.error('Storage Manager initialization failed', { 
        error: error.message,
        provider: this.config.provider 
      });
      throw error;
    }
  }

  private async initializeS3(): Promise<void> {
    if (!this.config.bucket) {
      throw new Error('S3 bucket name is required');
    }

    this.s3Client = new AWS.S3({
      region: this.config.region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: this.config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      signatureVersion: 'v4'
    });

    // Test connection
    try {
      await this.s3Client.headBucket({ Bucket: this.config.bucket }).promise();
      logger.info('S3 bucket accessible', { bucket: this.config.bucket });
    } catch (error) {
      if (error.code === 'NotFound') {
        throw new Error(`S3 bucket not found: ${this.config.bucket}`);
      }
      throw new Error(`S3 connection failed: ${error.message}`);
    }
  }

  private async initializeLocal(): Promise<void> {
    if (!this.config.localPath) {
      throw new Error('Local storage path is required');
    }

    try {
      await fs.access(this.config.localPath);
    } catch {
      await fs.mkdir(this.config.localPath, { recursive: true });
      logger.info('Local storage directory created', { path: this.config.localPath });
    }
  }

  async store(
    content: Buffer | string,
    key: string,
    options: StorageOptions = {}
  ): Promise<StorageResult> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const hash = this.calculateHash(buffer);
    const contentType = options.contentType || this.inferContentType(key);

    let processedBuffer = buffer;
    
    // Apply compression if enabled
    if (options.compression || this.config.compression) {
      processedBuffer = await this.compressBuffer(processedBuffer);
    }

    // Apply encryption if enabled
    if (options.encryption || this.config.encryption) {
      processedBuffer = await this.encryptBuffer(processedBuffer);
    }

    switch (this.config.provider) {
      case 's3':
        return await this.storeS3(processedBuffer, key, contentType, options, hash);
      case 'local':
        return await this.storeLocal(processedBuffer, key, contentType, options, hash);
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  private async storeS3(
    buffer: Buffer,
    key: string,
    contentType: string,
    options: StorageOptions,
    hash: string
  ): Promise<StorageResult> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.config.bucket!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentMD5: hash,
      CacheControl: options.cacheControl || 'max-age=31536000',
      ACL: options.acl || 'private',
      Metadata: {
        'original-hash': hash,
        'upload-timestamp': new Date().toISOString(),
        ...options.metadata
      }
    };

    if (options.expires) {
      params.Expires = options.expires;
    }

    if (options.tags) {
      const tagSet = Object.entries(options.tags).map(([Key, Value]) => ({ Key, Value }));
      params.Tagging = tagSet.map(tag => `${tag.Key}=${tag.Value}`).join('&');
    }

    try {
      const result = await this.s3Client!.upload(params).promise();
      
      const cdnUrl = this.config.cdnUrl 
        ? `${this.config.cdnUrl}/${key}`
        : result.Location;

      return {
        key,
        url: result.Location,
        size: buffer.length,
        hash,
        contentType,
        metadata: options.metadata,
        provider: 's3',
        bucket: this.config.bucket,
        cdnUrl
      };
    } catch (error) {
      logger.error('S3 upload failed', { 
        key, 
        bucket: this.config.bucket, 
        error: error.message 
      });
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }

  private async storeLocal(
    buffer: Buffer,
    key: string,
    contentType: string,
    options: StorageOptions,
    hash: string
  ): Promise<StorageResult> {
    const filePath = path.join(this.config.localPath!, key);
    const directory = path.dirname(filePath);

    try {
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      // Create metadata file if metadata exists
      if (options.metadata || Object.keys(options).length > 0) {
        const metadataPath = `${filePath}.meta`;
        const metadata = {
          contentType,
          hash,
          size: buffer.length,
          uploadTimestamp: new Date().toISOString(),
          ...options.metadata
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }

      const url = `file://${path.resolve(filePath)}`;
      const cdnUrl = this.config.cdnUrl 
        ? `${this.config.cdnUrl}/${key}`
        : url;

      return {
        key,
        url,
        size: buffer.length,
        hash,
        contentType,
        metadata: options.metadata,
        provider: 'local',
        cdnUrl
      };
    } catch (error) {
      logger.error('Local storage failed', { 
        key, 
        path: filePath, 
        error: error.message 
      });
      throw new Error(`Failed to store locally: ${error.message}`);
    }
  }

  async retrieve(key: string): Promise<{ content: Buffer; metadata?: Record<string, string> }> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    switch (this.config.provider) {
      case 's3':
        return await this.retrieveS3(key);
      case 'local':
        return await this.retrieveLocal(key);
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  private async retrieveS3(key: string): Promise<{ content: Buffer; metadata?: Record<string, string> }> {
    try {
      const result = await this.s3Client!.getObject({
        Bucket: this.config.bucket!,
        Key: key
      }).promise();

      let content = result.Body as Buffer;

      // Decrypt if encrypted
      if (this.config.encryption && result.Metadata?.encrypted === 'true') {
        content = await this.decryptBuffer(content);
      }

      // Decompress if compressed
      if (this.config.compression && result.Metadata?.compressed === 'true') {
        content = await this.decompressBuffer(content);
      }

      return {
        content,
        metadata: result.Metadata
      };
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new Error(`File not found: ${key}`);
      }
      throw new Error(`Failed to retrieve from S3: ${error.message}`);
    }
  }

  private async retrieveLocal(key: string): Promise<{ content: Buffer; metadata?: Record<string, string> }> {
    const filePath = path.join(this.config.localPath!, key);
    const metadataPath = `${filePath}.meta`;

    try {
      let content = await fs.readFile(filePath);
      let metadata: Record<string, string> | undefined;

      // Try to read metadata
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // Metadata file doesn't exist or is invalid
      }

      // Decrypt if encrypted
      if (this.config.encryption && metadata?.encrypted === 'true') {
        content = await this.decryptBuffer(content);
      }

      // Decompress if compressed
      if (this.config.compression && metadata?.compressed === 'true') {
        content = await this.decompressBuffer(content);
      }

      return { content, metadata };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw new Error(`Failed to retrieve locally: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    switch (this.config.provider) {
      case 's3':
        await this.deleteS3(key);
        break;
      case 'local':
        await this.deleteLocal(key);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  private async deleteS3(key: string): Promise<void> {
    try {
      await this.s3Client!.deleteObject({
        Bucket: this.config.bucket!,
        Key: key
      }).promise();
      
      logger.debug('File deleted from S3', { key, bucket: this.config.bucket });
    } catch (error) {
      throw new Error(`Failed to delete from S3: ${error.message}`);
    }
  }

  private async deleteLocal(key: string): Promise<void> {
    const filePath = path.join(this.config.localPath!, key);
    const metadataPath = `${filePath}.meta`;

    try {
      await fs.unlink(filePath);
      
      // Try to delete metadata file
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Metadata file might not exist
      }
      
      logger.debug('File deleted locally', { key, path: filePath });
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw new Error(`Failed to delete locally: ${error.message}`);
    }
  }

  async list(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<StorageListResult> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    switch (this.config.provider) {
      case 's3':
        return await this.listS3(prefix, maxKeys, continuationToken);
      case 'local':
        return await this.listLocal(prefix, maxKeys);
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  private async listS3(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<StorageListResult> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.config.bucket!,
        MaxKeys: maxKeys,
        Prefix: prefix,
        ContinuationToken: continuationToken
      };

      const result = await this.s3Client!.listObjectsV2(params).promise();
      
      const files = (result.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified!,
        etag: obj.ETag!.replace(/"/g, ''),
        contentType: undefined // Would need separate HeadObject call
      }));

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        files,
        totalSize,
        truncated: result.IsTruncated || false,
        nextContinuationToken: result.NextContinuationToken
      };
    } catch (error) {
      throw new Error(`Failed to list S3 objects: ${error.message}`);
    }
  }

  private async listLocal(prefix?: string, maxKeys: number = 1000): Promise<StorageListResult> {
    // Simplified local listing - in production, implement proper recursive search
    try {
      const basePath = this.config.localPath!;
      const searchPath = prefix ? path.join(basePath, prefix) : basePath;
      
      const files: any[] = [];
      let totalSize = 0;

      const readDir = async (dirPath: string, currentPrefix: string = ''): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxKeys) break;
          
          if (entry.isFile() && !entry.name.endsWith('.meta')) {
            const filePath = path.join(dirPath, entry.name);
            const relativePath = path.join(currentPrefix, entry.name);
            const stats = await fs.stat(filePath);
            
            files.push({
              key: relativePath.replace(/\\/g, '/'), // Normalize path separators
              size: stats.size,
              lastModified: stats.mtime,
              etag: this.calculateHash(await fs.readFile(filePath)),
              contentType: this.inferContentType(entry.name)
            });
            
            totalSize += stats.size;
          } else if (entry.isDirectory()) {
            const subPath = path.join(dirPath, entry.name);
            const subPrefix = path.join(currentPrefix, entry.name);
            await readDir(subPath, subPrefix);
          }
        }
      };

      await readDir(searchPath);

      return {
        files,
        totalSize,
        truncated: false // For simplicity
      };
    } catch (error) {
      throw new Error(`Failed to list local files: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    if (this.config.provider === 's3') {
      try {
        return await this.s3Client!.getSignedUrlPromise('getObject', {
          Bucket: this.config.bucket!,
          Key: key,
          Expires: expiresIn
        });
      } catch (error) {
        throw new Error(`Failed to generate signed URL: ${error.message}`);
      }
    } else if (this.config.provider === 'local') {
      // For local storage, return a direct file URL
      // In production, you might serve these through a web server
      const filePath = path.join(this.config.localPath!, key);
      return `file://${path.resolve(filePath)}`;
    }

    throw new Error(`Signed URLs not supported for provider: ${this.config.provider}`);
  }

  async copy(sourceKey: string, destinationKey: string): Promise<StorageResult> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    // Retrieve source content
    const { content, metadata } = await this.retrieve(sourceKey);
    
    // Store to destination
    return await this.store(content, destinationKey, {
      contentType: this.inferContentType(destinationKey),
      metadata
    });
  }

  async move(sourceKey: string, destinationKey: string): Promise<StorageResult> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    // Copy to destination
    const result = await this.copy(sourceKey, destinationKey);
    
    // Delete source
    await this.delete(sourceKey);
    
    return result;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      switch (this.config.provider) {
        case 's3':
          await this.s3Client!.headBucket({ Bucket: this.config.bucket! }).promise();
          return true;
        case 'local':
          await fs.access(this.config.localPath!);
          return true;
        default:
          return false;
      }
    } catch (error) {
      logger.error('Storage health check failed', { 
        provider: this.config.provider, 
        error: error.message 
      });
      return false;
    }
  }

  async getUsageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    provider: string;
    bucket?: string;
  }> {
    const listResult = await this.list();
    
    return {
      totalFiles: listResult.files.length,
      totalSize: listResult.totalSize,
      provider: this.config.provider,
      bucket: this.config.bucket
    };
  }

  // Helper methods
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private inferContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.jsx': 'text/jsx',
      '.ts': 'application/typescript',
      '.tsx': 'text/tsx',
      '.xml': 'application/xml',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async compressBuffer(buffer: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async decompressBuffer(buffer: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async encryptBuffer(buffer: Buffer): Promise<Buffer> {
    // Simple encryption - in production, use proper encryption
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    return Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
  }

  private async decryptBuffer(buffer: Buffer): Promise<Buffer> {
    // Simple decryption - in production, use proper decryption
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    
    return Buffer.concat([
      decipher.update(buffer),
      decipher.final()
    ]);
  }

  // Generate unique storage key
  generateKey(prefix: string = '', extension: string = ''): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(8).toString('hex');
    
    let key = `${timestamp}_${random}`;
    
    if (prefix) {
      key = `${prefix}/${key}`;
    }
    
    if (extension && !extension.startsWith('.')) {
      extension = `.${extension}`;
    }
    
    return key + extension;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initialized = false; // Require re-initialization
  }

  getConfig(): StorageConfig {
    // Return a copy to prevent external modification
    return { ...this.config };
  }
}