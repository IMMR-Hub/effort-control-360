import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos/app.css'
import Seguimiento from './pantallas/Seguimiento.jsx'

// La demo anterior sigue en src/App.jsx con sus datos inventados, sin tocar,
// hasta que cada una de sus pantallas tenga reemplazo contra la API real.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Seguimiento />
  </StrictMode>,
)
