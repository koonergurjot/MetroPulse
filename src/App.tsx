import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hero from './components/Hero';
import BusinessIdea from './components/BusinessIdea';
import DataArchitecture from './components/DataArchitecture';
import FeatureList from './components/FeatureList';
import SystemArchitecture from './components/SystemArchitecture';
import MarketingStrategy from './components/MarketingStrategy';
import LiveDemo from './components/LiveDemo';
import Navigation from './components/Navigation';

function App() {
  const [activeSection, setActiveSection] = useState('hero');

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      <Navigation activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeSection === 'hero' && <Hero onNavigate={setActiveSection} />}
          {activeSection === 'idea' && <BusinessIdea />}
          {activeSection === 'architecture' && <DataArchitecture />}
          {activeSection === 'features' && <FeatureList />}
          {activeSection === 'system' && <SystemArchitecture />}
          {activeSection === 'demo' && <LiveDemo />}
          {activeSection === 'marketing' && <MarketingStrategy />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
