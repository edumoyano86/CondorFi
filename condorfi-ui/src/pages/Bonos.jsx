/**
 * ==============================================================================
 * CondorFi - Vista de Renta Fija Soberana & Treasuries (Bonos.jsx)
 * ==============================================================================
 * Vista dedicada con fetch explícito (?categoria=bonos) y navegación modular:
 * Todos los Bonos, Soberanos Argentina (AL30, GD30, etc.) y US Treasuries (TLT, BND).
 */

import React from 'react';
import VistaMercado from './VistaMercado';

export default function Bonos() {
  return <VistaMercado categoria="bonos" />;
}

