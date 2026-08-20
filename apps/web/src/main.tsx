import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos/app.css';
import { Aplicacion } from './Aplicacion.js';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('No se encontró el elemento #root.');
}

createRoot(raiz).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
);
