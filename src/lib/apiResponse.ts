export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  console.log("Auth Response:", {
    url: response.url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: text,
  });

  if (!text) {
    return { success: false, error: "Empty response body" } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error("Non-JSON response:", {
      url: response.url,
      status: response.status,
      body: text,
    });
    return {
      success: false,
      error: "Unexpected response format",
      raw: text,
    } as T;
  }
}
