// Função serverless (roda na Vercel, não no navegador).
// A chave da Anthropic fica só aqui, em uma variável de ambiente,
// nunca é exposta pro usuário do site.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { topic, n, difficulty } = req.body || {};

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: 'Assunto inválido' });
    return;
  }

  const numQuestions = Math.min(Math.max(parseInt(n) || 6, 3), 10);
  const level = ['fácil', 'médio', 'difícil'].includes(difficulty) ? difficulty : 'médio';

  const prompt = `Gere um quiz de múltipla escolha em português (Brasil) sobre o assunto: "${topic}".
Nível de dificuldade: ${level}.
Gere exatamente ${numQuestions} perguntas.
Cada pergunta deve ter exatamente 4 alternativas, sendo apenas 1 correta.

Antes de criar as perguntas, identifique que TIPO de assunto é esse e adapte o foco:

- Se for uma matéria escolar/acadêmica ou de concurso (ex: matemática, português, história, direito, biologia, física, química, redação): foque no conteúdo que mais cai em prova/vestibular/concurso sobre esse tema — conceitos, fórmulas, regras e tópicos centrais que um estudante precisa dominar, do jeito que normalmente é cobrado em avaliações.

- Se for um jogo, esporte, hobby ou atividade prática (ex: um jogo específico, um esporte, um instrumento, uma técnica): foque no que realmente ajuda alguém a JOGAR/PRATICAR melhor — mecânicas, estratégias, controles, itens/armas/personagens, táticas, regras de gameplay, meta atual. Evite focar em curiosidades genéricas tipo datas de lançamento, motor gráfico, empresa desenvolvedora ou histórico da franquia, a menos que o assunto pedido seja explicitamente sobre história/curiosidades.

- Para qualquer outro assunto (cultura geral, tecnologia, atualidades, etc.): foque no que é mais útil e interessante pra alguém que quer aprender de verdade sobre o tema, com perguntas práticas e relevantes.

Responda APENAS com um JSON válido, compacto, sem texto antes ou depois, sem markdown, no seguinte formato exato:
{"questions":[{"question":"texto da pergunta","options":["alt1","alt2","alt3","alt4"],"correctIndex":0}]}
Seja bem direto: perguntas e alternativas curtas (máximo ~12 palavras cada). Não repita perguntas. Varie o índice da resposta correta entre as perguntas. Não inclua espaços ou quebras de linha desnecessárias no JSON.`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (anthropicRes.status === 429) {
      res.status(429).json({ error: 'Muitas requisições em pouco tempo. Espere alguns segundos e tente de novo.' });
      return;
    }
    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Erro da API Anthropic:', errBody);
      res.status(502).json({ error: 'Falha ao gerar perguntas' });
      return;
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      res.status(502).json({ error: 'Resposta sem conteúdo de texto' });
      return;
    }

    let raw = textBlock.text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();

    const parsed = JSON.parse(raw);
    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao gerar o quiz' });
  }
}
