// src/components/Alerta.jsx
// Caixinha simples pra mostrar erro ou sucesso. tipo: 'erro' | 'sucesso'

export default function Alerta({ tipo = 'erro', children }) {
  if (!children) return null;
  const estilos =
    tipo === 'erro'
      ? 'bg-error/10 text-error border-error/20'
      : 'bg-primary/10 text-primary border-primary/20';
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-md py-sm text-body-md ${estilos}`}>
      <span className="material-symbols-outlined text-[18px] mt-[1px] shrink-0">
        {tipo === 'erro' ? 'error' : 'check_circle'}
      </span>
      <span>{children}</span>
    </div>
  );
}
