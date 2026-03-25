import { useState, useEffect, useCallback, useRef } from 'react'

interface AsyncState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isIdle: boolean
  isSuccess: boolean
  isError: boolean
}

interface UseAsyncOptions {
  immediate?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useAsync<T = any>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = [],
  options: UseAsyncOptions = {}
) {
  const { immediate = true, onSuccess, onError } = options
  
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isIdle: true,
    isSuccess: false,
    isError: false,
  })

  const isMountedRef = useRef(true)
  const lastCallId = useRef(0)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    const callId = ++lastCallId.current

    setState(prev => ({
      ...prev,
      isLoading: true,
      isIdle: false,
      isError: false,
      error: null,
    }))

    try {
      const data = await asyncFunction()
      
      // Only update state if this is the most recent call and component is still mounted
      if (callId === lastCallId.current && isMountedRef.current) {
        setState({
          data,
          error: null,
          isLoading: false,
          isIdle: false,
          isSuccess: true,
          isError: false,
        })
        onSuccess?.(data)
      }
    } catch (error) {
      // Only update state if this is the most recent call and component is still mounted
      if (callId === lastCallId.current && isMountedRef.current) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setState({
          data: null,
          error: errorObj,
          isLoading: false,
          isIdle: false,
          isSuccess: false,
          isError: true,
        })
        onError?.(errorObj)
      }
    }
  }, [asyncFunction, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isIdle: true,
      isSuccess: false,
      isError: false,
    })
  }, [])

  // Execute on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, ...dependencies])

  return {
    ...state,
    execute,
    reset,
  }
}

// Specialized hook for API calls with retry logic
export function useAsyncWithRetry<T = any>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = [],
  options: UseAsyncOptions & {
    maxRetries?: number
    retryDelay?: number
    retryDelayMultiplier?: number
  } = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryDelayMultiplier = 2,
    ...asyncOptions
  } = options

  const [retryCount, setRetryCount] = useState(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout>()

  const wrappedAsyncFunction = useCallback(async () => {
    let currentRetry = 0
    let lastError: Error

    while (currentRetry <= maxRetries) {
      try {
        const result = await asyncFunction()
        setRetryCount(0) // Reset retry count on success
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (currentRetry === maxRetries) {
          throw lastError
        }

        currentRetry++
        setRetryCount(currentRetry)
        
        // Wait before retrying
        const delay = retryDelay * Math.pow(retryDelayMultiplier, currentRetry - 1)
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(resolve, delay)
        })
      }
    }

    throw lastError!
  }, [asyncFunction, maxRetries, retryDelay, retryDelayMultiplier])

  const asyncState = useAsync(wrappedAsyncFunction, dependencies, asyncOptions)

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...asyncState,
    retryCount,
    maxRetries,
  }
}

// Hook for debounced async operations
export function useDebouncedAsync<T = any>(
  asyncFunction: () => Promise<T>,
  delay: number = 300,
  dependencies: any[] = [],
  options: UseAsyncOptions = {}
) {
  const [debouncedDeps, setDebouncedDeps] = useState(dependencies)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedDeps(dependencies)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, dependencies)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useAsync(asyncFunction, debouncedDeps, options)
}

// Hook for polling data
export function usePolling<T = any>(
  asyncFunction: () => Promise<T>,
  interval: number = 5000,
  options: UseAsyncOptions & {
    enabled?: boolean
    stopOnError?: boolean
  } = {}
) {
  const { enabled = true, stopOnError = false, ...asyncOptions } = options
  const intervalRef = useRef<NodeJS.Timeout>()
  const [isPolling, setIsPolling] = useState(false)

  const asyncState = useAsync(asyncFunction, [], { ...asyncOptions, immediate: false })

  const startPolling = useCallback(() => {
    if (!enabled || isPolling) return

    setIsPolling(true)
    asyncState.execute() // Execute immediately

    intervalRef.current = setInterval(() => {
      asyncState.execute()
    }, interval)
  }, [enabled, isPolling, asyncState.execute, interval])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }
    setIsPolling(false)
  }, [])

  useEffect(() => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return stopPolling
  }, [enabled, startPolling, stopPolling])

  useEffect(() => {
    if (stopOnError && asyncState.isError) {
      stopPolling()
    }
  }, [stopOnError, asyncState.isError, stopPolling])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    ...asyncState,
    isPolling,
    startPolling,
    stopPolling,
  }
}

export default useAsync