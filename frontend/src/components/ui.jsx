// src/components/ui.jsx
// Peças reutilizáveis (botão, campo, cartão, etiqueta) usadas em todas as telas.

export function Botao({ variante = 'primario', tamanho = 'normal', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-label-bold text-label-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';
  const tamanhos = {
    normal: 'min-h-[48px] px-lg',
    pequeno: 'min-h-[36px] px-md text-[13px]',
    grande: 'min-h-[56px] px-lg',
  };
  const variantes = {
    primario: 'bg-primary text-on-primary hover:bg-primary-container shadow-sm',
    secundario: 'bg-surface-container-lowest text-on-surface border-2 border-outline-variant hover:bg-surface-container',
    perigo: 'bg-error/10 text-error hover:bg-error/20',
    perigoCheio: 'bg-error text-on-error hover:bg-error/90 shadow-sm',
    texto: 'text-primary hover:bg-primary/5',
  };
  return (
    <button className={`${base} ${tamanhos[tamanho]} ${variantes[variante]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Campo({ label, icone, className = '', as = 'input', children, ...props }) {
  const Tag = as;
  return (
    <label className="flex flex-col gap-xs w-full">
      {label && <span className="font-label-sm text-label-sm text-on-surface-variant ml-1">{label}</span>}
      <div className="relative flex items-center">
        {icone && (
          <span className="material-symbols-outlined absolute left-md text-on-surface-variant text-[20px] pointer-events-none">
            {icone}
          </span>
        )}
        <Tag
          className={`w-full bg-surface-container text-on-surface font-body-md text-body-md rounded-xl ${
            icone ? 'pl-[44px]' : 'pl-md'
          } pr-md py-[14px] outline-none border-2 border-transparent focus:border-primary transition-colors placeholder:text-on-surface-variant/50 ${className}`}
          {...props}
        >
          {children}
        </Tag>
      </div>
    </label>
  );
}

export function Cartao({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-surface rounded-2xl p-md shadow-[0_2px_8px_-2px_rgba(21,66,18,0.1)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Etiqueta({ tom = 'neutro', children }) {
  const tons = {
    verde: 'bg-primary/15 text-primary',
    vermelho: 'bg-error/15 text-error',
    neutro: 'bg-surface-variant text-on-surface-variant',
    amarelo: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  };
  return (
    <span
      className={`inline-flex items-center px-sm py-[2px] rounded-sm font-label-bold text-label-sm uppercase tracking-wider ${tons[tom]}`}
    >
      {children}
    </span>
  );
}

export function Titulo({ children, className = '' }) {
  return (
    <h1 className={`font-headline-lg-mobile text-headline-lg-mobile text-on-surface ${className}`}>{children}</h1>
  );
}

export function Secao({ children, className = '' }) {
  return <div className={`px-container-padding flex flex-col gap-sm pt-md ${className}`}>{children}</div>;
}

// Bloco de estatísticas do jogador (usado no próprio Perfil e no perfil de outros
// jogadores). Espera um objeto no formato devolvido por /api/desempenhos/me ou
// /api/desempenhos/:associadoId (jogos, gols, assistencias, ga, media_ga).
export function BlocoEstatisticas({ desempenho }) {
  if (!desempenho) return null;

  const linhas = [
    { rotulo: 'Jogos', valor: desempenho.jogos, icone: 'event' },
    { rotulo: 'Gols', valor: desempenho.gols, icone: 'sports_soccer' },
    { rotulo: 'Assistências', valor: desempenho.assistencias, icone: 'ads_click' },
    { rotulo: 'G/A', valor: desempenho.ga, icone: 'insights' },
    { rotulo: 'G/A (por jogo)', valor: desempenho.media_ga.toFixed(2), icone: 'speed' },
  ];

  return (
    <div className="w-full mt-sm pt-md border-t border-surface-variant flex flex-col gap-sm">
      <p className="font-label-bold text-label-sm text-on-surface-variant uppercase tracking-wider">
        Estatísticas
      </p>
      <div className="flex flex-col gap-2">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-center justify-between">
            <span className="text-body-md text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">{l.icone}</span>
              {l.rotulo}
            </span>
            <span className="font-label-bold text-body-md text-on-surface">{l.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Avatar circular com iniciais (não temos foto de perfil real no sistema)
export function Avatar({ nome = '', tamanho = 40, tom = 'neutro' }) {
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';
  const tons = {
    neutro: 'bg-surface-container-high text-on-surface-variant',
    verde: 'bg-primary-container text-on-primary-container',
    cinza: 'bg-secondary-container text-on-secondary-container',
  };
  return (
    <div
      className={`rounded-full flex items-center justify-center font-label-bold shrink-0 ${tons[tom]}`}
      style={{ width: tamanho, height: tamanho }}
    >
      {inicial}
    </div>
  );
}
