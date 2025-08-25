import React, { useState } from 'react';
import { Container, Image } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleImageClick = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      navigate('/login');
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-blue-800 to-cyan-600 relative overflow-hidden">
      {/* Arrière-plan animé */}
      <div className="absolute inset-0">
        <div className="absolute w-64 h-64 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Container className="relative z-10 flex flex-col items-center justify-center text-center">
        <Image
          src="ziris-logo.png"
          alt="ZIRIS Logo"
          onClick={handleImageClick}
          className={`ziris-logo ${isAnimating ? 'animate-click-zoom-rotate' : ''}`}
        />

        <div className="mt-6 bg-white/80 backdrop-blur-md rounded-lg px-6 py-8 shadow-lg max-w-2xl">
          <h1 className="text-grey text-4xl md:text-5xl font-poppins font-bold mb-4 animate-text-slide">
            Bienvenue chez ZIRIS
          </h1>
          <p className="text-grey text-lg md:text-xl font-poppins mb-2 animate-text-fade delay-1">
            ZIRIS, c’est votre allié pour la supervision intelligente des zones à risque industriel.
          </p>
          <p className="text-grey text-lg md:text-xl font-poppins mb-2 animate-text-fade delay-2">
            Analyse en temps réel, détection des anomalies et aide à la décision fiable.
          </p>
          <p className="text-grey text-lg md:text-xl font-poppins animate-text-fade delay-3">
            Sécurisez vos installations, anticipez les risques et gardez le contrôle.
          </p>
        </div>
      </Container>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

          .font-poppins {
            font-family: 'Poppins', sans-serif;
          }

          .ziris-logo {
            width: 240px;
            max-width: 45%;
            height: auto;
            cursor: pointer;
            transition: transform 0.4s ease;
            animation: bounceRotate 2.5s infinite;
          }

          .animate-text-slide {
            animation: textSlide 1.2s ease-out forwards;
            opacity: 0;
          }

          .animate-text-fade {
            animation: textFade 1.2s ease-out forwards;
            opacity: 0;
          }

          .delay-1 {
            animation-delay: 0.5s;
          }
          .delay-2 {
            animation-delay: 1s;
          }
          .delay-3 {
            animation-delay: 1.5s;
          }

          .animate-click-zoom-rotate {
            animation: clickZoomRotate 0.8s ease-out forwards;
          }

          .animate-blob {
            animation: blob 7s infinite;
          }

          .animation-delay-2000 {
            animation-delay: 2s;
          }

          .animation-delay-4000 {
            animation-delay: 4s;
          }

          @keyframes bounceRotate {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(5deg); }
          }

          @keyframes textSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes textFade {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes clickZoomRotate {
            0% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.2) rotate(360deg); }
            100% { transform: scale(1) rotate(0deg); }
          }

          @keyframes blob {
            0% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(40px, -40px) scale(1.05); }
            66% { transform: translate(-40px, 40px) scale(0.95); }
            100% { transform: translate(0, 0) scale(1); }
          }

          @media (max-width: 768px) {
            .ziris-logo {
              width: 180px;
              max-width: 60%;
            }
            .text-4xl {
              font-size: 2rem;
            }
            .text-5xl {
              font-size: 2.5rem;
            }
            .text-lg {
              font-size: 1rem;
            }
            .text-xl {
              font-size: 1.25rem;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Home;
