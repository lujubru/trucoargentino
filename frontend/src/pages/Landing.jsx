import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Spade, Users, Trophy, MessageCircle, Wallet, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Users className="w-8 h-8" />,
      title: 'MULTIJUGADOR',
      description: 'Partidas 1v1, 2v2 y 3v3 en tiempo real'
    },
    {
      icon: <Wallet className="w-8 h-8" />,
      title: 'CASHBANK',
      description: 'Sistema de billetera interno seguro'
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: 'PREMIOS',
      description: '70% del pozo para los ganadores'
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: 'CHAT',
      description: 'Chat global, privado y en partidas'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'SEGURIDAD',
      description: 'Transacciones protegidas y verificadas'
    },
    {
      icon: <Spade className="w-8 h-8" />,
      title: 'TRUCO REAL',
      description: 'Reglas oficiales del Truco argentino'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1663110094638-0d4abe240fb6?crop=entropy&cs=srgb&fm=jpg&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Hero */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <Spade className="w-10 h-10 text-[#FFD700]" />
              <span className="font-display text-2xl tracking-widest text-white">TRUCO ARGENTINO</span>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-4"
            >
              <Button 
                variant="ghost" 
                className="text-white hover:text-[#FFD700] hover:bg-transparent"
                onClick={() => navigate('/login')}
                data-testid="login-nav-btn"
              >
                Ingresar
              </Button>
              <Button 
                className="btn-gold px-6"
                onClick={() => navigate('/register')}
                data-testid="register-nav-btn"
              >
                Registrarse
              </Button>
            </motion.div>
          </nav>
        </header>

        {/* Hero Content */}
        <section className="container mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display text-5xl md:text-7xl lg:text-8xl text-white leading-none mb-6"
            >
              JUGÁ AL <span className="text-[#FFD700]">TRUCO</span> ONLINE
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl"
            >
              La plataforma definitiva para jugar Truco argentino con amigos o rivales de todo el país. Apostá, ganá y demostrá quién es el mejor.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button 
                size="lg"
                className="btn-gold text-lg px-8 py-6"
                onClick={() => navigate('/register')}
                data-testid="cta-register-btn"
              >
                EMPEZAR A JUGAR
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 text-lg px-8 py-6"
                onClick={() => navigate('/login')}
                data-testid="cta-login-btn"
              >
                YA TENGO CUENTA
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-6 py-20">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl text-center text-white mb-16"
          >
            TODO LO QUE <span className="text-[#FFD700]">NECESITÁS</span>
          </motion.h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 rounded-xl hover:border-[#FFD700]/30 transition-colors duration-300"
              >
                <div className="text-[#FFD700] mb-4">{feature.icon}</div>
                <h3 className="font-display text-xl text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Social Proof */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img 
                src="https://images.unsplash.com/photo-1554103123-7f630b63626e?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Amigos jugando cartas"
                className="rounded-xl shadow-2xl"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-3xl md:text-4xl text-white mb-6">
                JUGÁ CON <span className="text-[#2ECC71]">AMIGOS</span>
              </h2>
              <p className="text-gray-400 mb-6">
                Creá partidas privadas, compartí el código por WhatsApp e invitá a tus amigos a jugar. 
                El Truco nunca fue tan fácil de organizar.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-2 h-2 bg-[#FFD700] rounded-full" />
                  Código único para cada partida
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-2 h-2 bg-[#FFD700] rounded-full" />
                  Link de invitación compartible
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-2 h-2 bg-[#FFD700] rounded-full" />
                  Chat privado entre compañeros
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass p-12 rounded-2xl text-center"
          >
            <h2 className="font-display text-4xl md:text-5xl text-white mb-6">
              ¿LISTO PARA <span className="text-[#FFD700]">JUGAR</span>?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Registrate gratis y empezá a jugar Truco online con jugadores de toda Argentina.
            </p>
            <Button 
              size="lg"
              className="btn-gold text-lg px-12 py-6"
              onClick={() => navigate('/register')}
              data-testid="final-cta-btn"
            >
              CREAR CUENTA GRATIS
            </Button>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-500">
              <Spade className="w-5 h-5" />
              <span>Truco Argentino © 2024</span>
            </div>
            <p className="text-gray-500 text-sm">
              Hecho con pasión en Argentina
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
