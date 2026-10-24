/**
 * ==============================================================================
 * CondorFi - Vista de Renta Variable & Acciones (Acciones.jsx)
 * ==============================================================================
 * Vista institucional dedicada con gestión de estado de carga garantizada.
 * Realiza fetch explícito a /api/scrapper-tradfi?categoria=acciones y asegura
 * la ejecución obligatoria de (isLoading = false) dentro del bloque finally
 * para desbloquear siempre el botón 'Calculando Modelos...'.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import VistaMercado from './VistaMercado';

export default function Acciones() {
  const context = useOutletContext() || {};
  const { setDatosScreener } = context;

  const [isLoading, setIsLoading] = useState(false);
  const [activosAcciones, setActivosAcciones] = useState([]);

  // Consulta cuantitativa explícita de las 100 acciones líderes y tech
  const ejecutarCargaAcciones = useCallback(async () => {
    setIsLoading(true);

    try {
      const respuesta = await fetch('/api/scrapper-tradfi?categoria=acciones');

      if (!respuesta.ok) {
        throw new Error(`Fallo de respuesta HTTP: status ${respuesta.status}`);
      }

      const datos = await respuesta.json();
      const items = Array.isArray(datos.screener) && datos.screener.length > 0
        ? datos.screener
        : (Array.isArray(datos.activos) && datos.activos.length > 0 ? datos.activos : []);

      if (items.length > 0) {
        setActivosAcciones(items);

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
      console.error('[Acciones.jsx] Error al capturar acciones líderes:', err);
    } finally {
      // OBLIGATORIO: Garantizar la liberación del botón en el bloque finally
      setIsLoading(false);
    }
  }, [setDatosScreener]);

  useEffect(() => {
    ejecutarCargaAcciones();
  }, [ejecutarCargaAcciones]);

  return (
    <VistaMercado
      categoria="acciones"
      activosExternos={activosAcciones}
      isLoadingExterno={isLoading}
      onRefrescarExterno={ejecutarCargaAcciones}
    />
  );
}
