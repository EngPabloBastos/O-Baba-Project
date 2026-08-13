// src/components/Alerta.jsx
// Caixinha simples pra mostrar erro ou sucesso. tipo: 'erro' | 'sucesso'

export default function Alerta({ tipo = 'erro', children }) {
  if (!children) return null;
  return <div className={`alerta alerta-${tipo}`}>{children}</div>;
}
