const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-lite";
const DIMS = 512;
const BATCH_SIZE = 8;

type VoyageResponse = {
  data: Array<{ embedding: number[] }>;
};

export async function embedTexts(
  texts: string[],
  apiKey: string
): Promise<Float32Array[]> {
  const results: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    const batch = texts.slice(i, i + BATCH_SIZE);

    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: batch, model: MODEL }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Voyage API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as VoyageResponse;

    for (const item of json.data) {
      if (item.embedding.length !== DIMS) {
        throw new Error(
          `Expected ${DIMS} dims, got ${item.embedding.length}`
        );
      }
      results.push(new Float32Array(item.embedding));
    }
  }

  return results;
}
