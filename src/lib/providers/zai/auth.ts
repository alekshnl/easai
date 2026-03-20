const ZAI_TOKEN_URL = "https://api.z.ai/api/auth/z/zaiAuthToken";
const ZAI_LOGIN_URL = "https://api.z.ai/api/auth/z/login";
const ZAI_PROFILE_URL = "https://api.z.ai/api/biz/customer/getCustomerInfo";

const ZAI_CLIENT_ID = "client_lS94_Ka2ycE9IwCNYisudg";
const ZAI_REDIRECT_URI = "http://127.0.0.1:1456/auth/callback";

export function generateZaiAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZAI_CLIENT_ID,
    redirect_uri: ZAI_REDIRECT_URI,
    state,
  });
  return `https://chat.z.ai/auth?${params.toString()}`;
}

export async function exchangeZaiAuthCode(code: string): Promise<{ accessToken: string }> {
  const res = await fetch(ZAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      clientId: ZAI_CLIENT_ID,
      authCode: code,
      redirectUri: ZAI_REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Z.AI token exchange failed: ${data.msg || data.code}`);
  }

  const shortLivedToken = data.data?.access_token;
  if (!shortLivedToken) {
    throw new Error("Z.AI token exchange: no access_token in response");
  }

  const loginRes = await fetch(ZAI_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: shortLivedToken }),
  });

  const loginData = await loginRes.json();
  if (loginData.code !== 200) {
    throw new Error(`Z.AI login failed: ${loginData.msg || loginData.code}`);
  }

  const accessToken = loginData.data?.access_token || loginData.data?.token;
  if (!accessToken) {
    throw new Error("Z.AI login: no access_token in response");
  }

  return { accessToken };
}

export interface ZaiProfile {
  email: string;
  customerNumber: string;
  id: string;
  organizationId: string;
}

export async function fetchZaiProfile(token: string): Promise<ZaiProfile> {
  const res = await fetch(ZAI_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Z.AI profile fetch failed: ${data.msg || data.code}`);
  }

  const info = data.data;
  const org = Array.isArray(info.organizations)
    ? info.organizations.find((o: Record<string, unknown>) => o.isDefault) || info.organizations[0]
    : null;

  return {
    email: info.email || info.userEmail || `customer-${info.customerNumber}`,
    customerNumber: info.customerNumber || "",
    id: info.id || "",
    organizationId: (org?.organizationId as string) || "",
  };
}
