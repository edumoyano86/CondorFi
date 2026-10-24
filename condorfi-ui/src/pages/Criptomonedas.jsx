/**
 * ==============================================================================
 * CondorFi - Vista de Criptomonedas & Arbitraje (Criptomonedas.jsx)
 * ==============================================================================
 * Vista dedicada con fetch explícito (/api/bot o /api/generar-insights?categoria=cripto)
 * y navegación modular por sub-pestañas: Todas las Criptos, Core & High-Cap,
 * Layer 1 & 2, DeFi & RWA, e IA & Memecoins.
 */

import React from 'react';
import VistaMercado from './VistaMercado';

export default function Criptomonedas() {
  return <VistaMercado categoria="cripto" />;
}

