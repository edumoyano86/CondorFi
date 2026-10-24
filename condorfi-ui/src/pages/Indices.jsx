/**
 * ==============================================================================
 * CondorFi - Vista de Índices Financieros Globales (Indices.jsx)
 * ==============================================================================
 * Vista institucional dedicada con gestión de estado de carga garantizada.
 * Realiza fetch explícito a /api/scrapper-tradfi?categoria=indices y asegura
 * la ejecución obligatoria de (isLoading = false) dentro del bloque finally
 * para desbloquear siempre el botón 'Calculando Modelos...'.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import VistaMercado from './VistaMercado';

export default function Indices() {
  const context = useOutletContext() || {};
  const { setDatosScreener } = context;

  const [isLoading, setIsLoading] = useState(false);
  const [activosIndices, setActivosIndices] = useState([]);

  // Consulta cuantitativa explícita de los 100 benchmarks globales
  const ejecutarCargaIndices = useCallback(async () => {
    setIsLoading(true);

    try {
      const respuesta = await fetch('/api/scrapper-tradfi?categoria=indices');

      if (!respuesta.ok) {
        throw new Error(`Fallo de respuesta HTTP: status ${respuesta.status}`);
      }

      const datos = await respuesta.json();
      const items = Array.isArray(datos.screener) && datos.screener.length > 0
        ? datos.screener
        : (Array.isArray(datos.activos) && datos.activos.length > 0 ? datos.activos : []);

      if (items.length > 0) {
        setActivosIndices(items);

        // Sincronizar catálogo masivo con el estado global de la terminal
        if (typeof setDatosScreener === 'function') {
          setDatosScreener((prev) => {
            const mapa = new Map();
            (prev || []).forEach((it) => {
              const k = (it.activo || it.ticker || '').toUpperCase();
              if (k) mapa.set(k, it);
            });
            items.forEach((it) => {
              const k = (it.activo || it.ticker || '').toUpperCase();
              if (k) mapa.set(k, it);
            });
            return Array.from(mapa.values());
          });
        }
      }
    } catch (err) {
      console.error('[Indices.jsx] Error al capturar índices globales:', err);
    } finally {
      // OBLIGATORIO: Garantizar la liberación del botón en el bloque finally
      setIsLoading(false);
    }
  }, [setDatosScreener]);

  useEffect(() => {
    ejecutarCargaIndices();
  }, [ejecutarCargaIndices]);

  return (
    <VistaMercado
      categoria="indices"
      activosExternos={activosIndices}
      isLoadingExterno={isLoading}
      onRefrescarExterno={ejecutarCargaIndices}
    />
  );
}
