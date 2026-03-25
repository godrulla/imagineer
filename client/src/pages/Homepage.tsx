import { Link } from 'react-router-dom'
import { 
  FileText, 
  Zap, 
  TrendingUp, 
  ArrowRight,
  CheckCircle,
  Users,
  Globe,
  Sparkles
} from 'lucide-react'
import DynamicBackground from '../components/DynamicBackground'

export default function Homepage() {
  const features = [
    {
      icon: <FileText className="h-8 w-8 text-white" />,
      title: "Import Designs",
      description: "Connect your Figma files and import designs instantly with our advanced parsing technology"
    },
    {
      icon: <Zap className="h-8 w-8 text-white" />,
      title: "AI Translation",
      description: "Convert designs to LLM-ready formats with 90%+ accuracy using multiple AI providers"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-white" />,
      title: "Multi-Format Export",
      description: "Export in multiple formats optimized for GPT, Claude, Gemini, and other LLMs"
    }
  ]

  const benefits = [
    "Bridge the gap between visual design and AI development",
    "Support for Figma, Photoshop, and other design tools",
    "Multiple LLM provider integrations (OpenAI, Anthropic, Google)",
    "Real-time collaboration and version control",
    "Enterprise-grade security and compliance",
    "Seamless integration with existing workflows"
  ]

  return (
    <div className="relative min-h-screen">
      {/* Dynamic Background */}
      <DynamicBackground 
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Hero Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <div className="mx-auto w-32 h-32 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mb-8 shadow-xl border border-white/20">
                <Sparkles className="h-16 w-16 text-white" />
              </div>
              
              <h1 className="text-6xl font-bold text-white mb-6 drop-shadow-lg">
                Welcome to <span className="text-yellow-300">Imagineer</span>
              </h1>
              
              <p className="text-2xl text-white/90 mb-8 max-w-4xl mx-auto drop-shadow-md leading-relaxed">
                The revolutionary design-to-LLM translation platform that bridges the gap between visual design tools and Large Language Models.
              </p>
              
              <p className="text-lg text-white/80 mb-12 max-w-3xl mx-auto">
                Transform your Figma designs into AI-ready formats with unprecedented accuracy. 
                Built for designers, developers, and AI engineers who demand excellence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                <Link 
                  to="/register" 
                  className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-semibold text-xl px-10 py-4 rounded-xl hover:bg-white/30 transition-all duration-300 shadow-xl border border-white/30 hover:scale-105"
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-2 bg-transparent text-white font-semibold text-xl px-10 py-4 rounded-xl border-2 border-white/50 hover:bg-white/10 transition-all duration-300"
                >
                  Sign In
                  <Users className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">
                Powerful Features
              </h2>
              <p className="text-xl text-white/80 max-w-3xl mx-auto">
                Everything you need to transform designs into AI-ready formats
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105"
                >
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border border-white/30">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-white">{feature.title}</h3>
                  <p className="text-white/80 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-white mb-6 drop-shadow-lg">
                  Why Choose Imagineer?
                </h2>
                <p className="text-xl text-white/80 mb-8">
                  Built by <strong>Armando Diaz Silverio</strong> and the team at <strong>Exxede Investments</strong>, 
                  Imagineer represents the cutting edge of design-to-AI translation technology.
                </p>
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-green-400 mt-1 flex-shrink-0" />
                      <span className="text-white/90">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
                <div className="text-center">
                  <Globe className="h-20 w-20 text-white mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-white mb-4">Global Scale</h3>
                  <p className="text-white/80 mb-6">
                    Trusted by design teams and AI developers worldwide, from startups to Fortune 500 companies.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-yellow-300">90%+</div>
                      <div className="text-sm text-white/70">Accuracy Rate</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-yellow-300">50ms</div>
                      <div className="text-sm text-white/70">Avg Response</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6 drop-shadow-lg">
              Ready to Transform Your Design Workflow?
            </h2>
            <p className="text-xl text-white/80 mb-8">
              Join thousands of designers and developers who trust Imagineer for their design-to-AI needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/register" 
                className="inline-flex items-center gap-2 bg-white text-purple-600 font-bold text-xl px-12 py-5 rounded-xl hover:bg-white/90 transition-all duration-300 shadow-xl hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="h-6 w-6" />
              </Link>
              <Link 
                to="/templates" 
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-semibold text-xl px-12 py-5 rounded-xl hover:bg-white/30 transition-all duration-300 shadow-xl border border-white/30"
              >
                View Templates
                <FileText className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/20">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-white/60">
              © 2025 Imagineer by <strong>Exxede Investments</strong>. 
              Founded by <strong>Armando Diaz Silverio</strong> in Punta Cana, Dominican Republic.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}