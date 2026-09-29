// src/components/Conquistas.jsx
// Insígnias dos prêmios (mensais em círculo, anuais em escudo) e o bloco "Conquistas"
// usado nos perfis. As artes ficam em src/assets/medalhas.

import artilheiro from '../assets/medalhas/artilheiro.png';
import garcom from '../assets/medalhas/garcom.png';
import melhorPontos from '../assets/medalhas/melhor_jogador_por_pontos.png';
import melhorVoto from '../assets/medalhas/melhor_jogador_por_voto.png';
import xerife from '../assets/medalhas/xerife.png';
import melhorGoleiro from '../assets/medalhas/melhor_goleiro.png';
import artilheiroAno from '../assets/medalhas/artilheiro_do_ano.png';
import garcomAno from '../assets/medalhas/garcom_do_ano.png';
import melhorPontosAno from '../assets/medalhas/melhor_jogador_por_pontos_do_ano.png';
import melhorVotoAno from '../assets/medalhas/melhor_jogador_por_voto_do_ano.png';
import xerifeAno from '../assets/medalhas/xerife_do_ano.png';
import melhorGoleiroAno from '../assets/medalhas/melhor_goleiro_do_ano.png';
import { Cartao, RotuloSecao } from './ui.jsx';

// Mesma ordem do backend (lib/premiacoes.js).
export const PREMIOS = {
  artilheiro: { rotulo: 'Artilheiro', mensal: artilheiro, anual: artilheiroAno },
  garcom: { rotulo: 'Garçom', mensal: garcom, anual: garcomAno },
  melhor_jogador_por_pontos: {
    rotulo: 'Melhor Jogador por Pontos',
    mensal: melhorPontos,
    anual: melhorPontosAno,
  },
  melhor_jogador_por_voto: { rotulo: 'Melhor Jogador por Voto', mensal: melhorVoto, anual: melhorVotoAno },
  xerife: { rotulo: 'Xerife', mensal: xerife, anual: xerifeAno },
  melhor_goleiro: { rotulo: 'Melhor Goleiro', mensal: melhorGoleiro, anual: melhorGoleiroAno },
};

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function mesCurto({ ano, mes }) {
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

// Imagem da insígnia. `tamanho` é a largura em px (a mensal é quadrada; a anual, um
// escudo levemente mais alto). `apagada` deixa em cinza (prêmio ainda não definido).
export function Insignia({ tipo, anual = false, tamanho = 64, apagada = false }) {
  const premio = PREMIOS[tipo];
  if (!premio) return null;
  return (
    <img
      src={anual ? premio.anual : premio.mensal}
      alt={anual ? `${premio.rotulo} do Ano` : premio.rotulo}
      width={tamanho}
      style={{ width: tamanho, height: 'auto' }}
      className={`shrink-0 select-none ${apagada ? 'opacity-30 grayscale' : ''}`}
      draggable={false}
    />
  );
}

function Grupo({ titulo, itens, anual }) {
  return (
    <div className="flex flex-col gap-sm">
      <RotuloSecao>{titulo}</RotuloSecao>
      <div className="grid grid-cols-2 gap-sm">
        {itens.map((c) => (
          <div
            key={c.tipo}
            className="relative flex flex-col items-center text-center gap-1 bg-surface-container rounded-xl px-sm pt-md pb-sm"
          >
            <span className="absolute top-2 right-2 bg-surface-container-lowest text-on-surface rounded-full px-2 py-[1px] font-label-bold text-label-sm tabular-nums">
              {c.quantidade}x
            </span>
            <Insignia tipo={c.tipo} anual={anual} tamanho={anual ? 76 : 68} />
            <span className="font-label-bold text-label-sm text-on-surface leading-tight mt-1">
              {PREMIOS[c.tipo].rotulo}
              {anual ? ' do Ano' : ''}
            </span>
            <span className="text-label-sm text-on-surface-variant leading-tight">
              {anual ? c.periodos.join(', ') : c.periodos.map(mesCurto).join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Espera o objeto devolvido por GET /api/premiacoes/jogador/:id ({ mensais, anuais }).
export function BlocoConquistas({ conquistas }) {
  if (!conquistas) return null;
  const vazio = conquistas.anuais.length === 0 && conquistas.mensais.length === 0;

  return (
    <Cartao className="flex flex-col gap-md">
      <RotuloSecao>Conquistas</RotuloSecao>
      {vazio ? (
        <p className="text-body-md text-on-surface-variant -mt-2">Nenhuma conquista ainda.</p>
      ) : (
        <>
          {conquistas.anuais.length > 0 && <Grupo titulo="Do ano" itens={conquistas.anuais} anual />}
          {conquistas.mensais.length > 0 && <Grupo titulo="Mensais" itens={conquistas.mensais} anual={false} />}
        </>
      )}
    </Cartao>
  );
}
