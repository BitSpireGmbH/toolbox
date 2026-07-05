import { describe, it, expect, beforeEach } from 'vitest';
import {
  CurlToHttpClientConverterService,
  CurlToHttpClientOptions,
} from './curl-to-httpclient-converter.service';

describe('CurlToHttpClientConverterService', () => {
  let service: CurlToHttpClientConverterService;

  const defaultOptions: CurlToHttpClientOptions = {
    clientStyle: 'inline',
    serializer: 'System.Text.Json',
    generateBodyRecord: false,
    wrapInAsyncMethod: false,
  };

  beforeEach(() => {
    service = new CurlToHttpClientConverterService();
  });

  describe('parseCurl', () => {
    it('parses a bare GET request', () => {
      const result = service.parseCurl('curl https://api.github.com/users/octocat');
      expect(result.method).toBe('GET');
      expect(result.baseAddress).toBe('https://api.github.com');
      expect(result.path).toBe('/users/octocat');
      expect(result.headers).toEqual([]);
      expect(result.body).toBeUndefined();
    });

    it('parses explicit -X POST with JSON body', () => {
      const curl = `curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"Alice"}'`;
      const result = service.parseCurl(curl);
      expect(result.method).toBe('POST');
      expect(result.path).toBe('/users');
      expect(result.headers.find(h => h.name === 'Content-Type')?.value).toBe('application/json');
      expect(result.body?.kind).toBe('json');
      expect(result.body?.raw).toBe('{"name":"Alice"}');
    });

    it('infers POST when body is present but no -X', () => {
      const curl = `curl https://api.example.com/login -d 'user=alice&pass=secret'`;
      const result = service.parseCurl(curl);
      expect(result.method).toBe('POST');
      expect(result.body?.kind).toBe('urlencoded');
    });

    it('handles multi-line cURL with backslash continuations', () => {
      const curl = `curl -X PUT 'https://api.example.com/orders/42' \\
        -H 'Authorization: Bearer abc123' \\
        -H 'Content-Type: application/json' \\
        -d '{"status":"shipped"}'`;
      const result = service.parseCurl(curl);
      expect(result.method).toBe('PUT');
      expect(result.headers.length).toBe(2);
      expect(result.body?.kind).toBe('json');
    });

    it('parses basic auth with -u', () => {
      const result = service.parseCurl(`curl -u alice:secret https://api.example.com/me`);
      expect(result.basicAuth).toEqual({ user: 'alice', pass: 'secret' });
    });

    it('parses Authorization header', () => {
      const result = service.parseCurl(`curl -H 'Authorization: Bearer xyz' https://api.example.com/me`);
      expect(result.headers[0]).toEqual({ name: 'Authorization', value: 'Bearer xyz' });
    });

    it('parses multipart -F fields including @filename for files', () => {
      const curl = `curl -X POST https://api.example.com/upload -F 'note=Q3' -F 'file=@./report.pdf'`;
      const result = service.parseCurl(curl);
      expect(result.body?.kind).toBe('multipart');
      const fields = result.body?.formFields ?? [];
      expect(fields).toHaveLength(2);
      const note = fields.find(f => f.name === 'note');
      const file = fields.find(f => f.name === 'file');
      expect(note?.isFile).toBe(false);
      expect(note?.value).toBe('Q3');
      expect(file?.isFile).toBe(true);
      expect(file?.filename).toBe('./report.pdf');
    });

    it('uses --url flag for URL', () => {
      const result = service.parseCurl(`curl --url 'https://api.example.com/x' -X DELETE`);
      expect(result.url).toBe('https://api.example.com/x');
      expect(result.method).toBe('DELETE');
    });

    it('handles both single and double quoted strings', () => {
      const curl = `curl -H "Accept: application/json" -H 'X-Token: tok' "https://api.example.com/x"`;
      const result = service.parseCurl(curl);
      expect(result.headers).toHaveLength(2);
      expect(result.headers.find(h => h.name === 'X-Token')?.value).toBe('tok');
      expect(result.url).toBe('https://api.example.com/x');
    });

    it('throws on empty input', () => {
      expect(() => service.parseCurl('')).toThrow();
    });

    it('throws when URL is missing', () => {
      expect(() => service.parseCurl(`curl -X GET -H 'X: y'`)).toThrow(/url/i);
    });

    it('throws on unsupported method', () => {
      expect(() => service.parseCurl(`curl -X TEAPOT https://api.example.com`)).toThrow(/method/i);
    });
  });

  describe('generate — inline client style', () => {
    it('emits HttpClient with BaseAddress and HttpRequestMessage', () => {
      const code = service.convert(`curl https://api.example.com/ping`, defaultOptions);
      expect(code).toContain('new HttpClient { BaseAddress = new Uri("https://api.example.com") }');
      expect(code).toContain('new HttpRequestMessage(HttpMethod.Get, "/ping")');
      expect(code).toContain('client.SendAsync(request)');
      expect(code).toContain('EnsureSuccessStatusCode');
    });

    it('wraps in async method when wrapInAsyncMethod is true', () => {
      const code = service.convert(`curl https://api.example.com/ping`, {
        ...defaultOptions,
        wrapInAsyncMethod: true,
      });
      expect(code).toMatch(/public static async Task<string> \w+Async\(CancellationToken/);
      expect(code).toContain('cancellationToken');
    });

    it('emits AuthenticationHeaderValue for Bearer Authorization header', () => {
      const code = service.convert(
        `curl -H 'Authorization: Bearer mytoken' https://api.example.com/me`,
        defaultOptions,
      );
      expect(code).toContain(
        'request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "mytoken")',
      );
    });

    it('emits Basic auth from -u flag with base64 encoding', () => {
      const code = service.convert(`curl -u alice:secret https://api.example.com/me`, defaultOptions);
      // base64('alice:secret') = YWxpY2U6c2VjcmV0
      expect(code).toContain('new AuthenticationHeaderValue("Basic", "YWxpY2U6c2VjcmV0")');
    });

    it('emits JSON body via StringContent when generateBodyRecord is false (STJ)', () => {
      const code = service.convert(
        `curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"name":"Alice"}'`,
        defaultOptions,
      );
      expect(code).toContain('StringContent');
      expect(code).toContain('application/json');
      expect(code).toContain('{"name":"Alice"}');
    });

    it('emits JsonContent.Create when generateBodyRecord is true (STJ)', () => {
      const code = service.convert(
        `curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"name":"Alice","age":30}'`,
        { ...defaultOptions, generateBodyRecord: true },
      );
      expect(code).toContain('public sealed record');
      expect(code).toContain('string Name');
      expect(code).toContain('int Age');
      expect(code).toContain('JsonContent.Create(payload)');
    });

    it('emits Newtonsoft.Json serialization when serializer is Newtonsoft', () => {
      const code = service.convert(
        `curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"name":"Alice"}'`,
        { ...defaultOptions, serializer: 'Newtonsoft.Json', generateBodyRecord: true },
      );
      expect(code).toContain('using Newtonsoft.Json;');
      expect(code).toContain('JsonConvert.SerializeObject');
    });

    it('emits FormUrlEncodedContent for urlencoded bodies', () => {
      const code = service.convert(
        `curl -X POST https://api.example.com/login -d 'user=alice&pass=secret'`,
        defaultOptions,
      );
      expect(code).toContain('Dictionary<string, string>');
      expect(code).toContain('["user"] = "alice"');
      expect(code).toContain('["pass"] = "secret"');
      expect(code).toContain('FormUrlEncodedContent');
    });

    it('emits MultipartFormDataContent with StreamContent for file uploads', () => {
      const code = service.convert(
        `curl -X POST https://api.example.com/upload -F 'note=Q3' -F 'file=@./report.pdf'`,
        defaultOptions,
      );
      expect(code).toContain('MultipartFormDataContent');
      expect(code).toContain('new StringContent("Q3"), "note"');
      expect(code).toContain('File.OpenRead("./report.pdf")');
      expect(code).toContain('new StreamContent');
    });
  });

  describe('generate — factory client style', () => {
    it('uses IHttpClientFactory.CreateClient', () => {
      const code = service.convert(`curl https://api.example.com/ping`, {
        ...defaultOptions,
        clientStyle: 'factory',
      });
      expect(code).toContain('IHttpClientFactory httpClientFactory');
      expect(code).toContain('httpClientFactory.CreateClient("api")');
      expect(code).toContain('builder.Services.AddHttpClient');
    });
  });

  describe('generate — typed client style', () => {
    it('generates a sealed class with primary constructor accepting HttpClient', () => {
      const code = service.convert(`curl https://api.example.com/users/me`, {
        ...defaultOptions,
        clientStyle: 'typed',
      });
      expect(code).toMatch(/public sealed class \w+Client\(HttpClient client\)/);
      expect(code).toContain('AddHttpClient<');
    });

    it('uses provided typedClientName when supplied', () => {
      const code = service.convert(`curl https://api.example.com/users`, {
        ...defaultOptions,
        clientStyle: 'typed',
        typedClientName: 'GitHubApiClient',
      });
      expect(code).toContain('public sealed class GitHubApiClient(HttpClient client)');
      expect(code).toContain('AddHttpClient<GitHubApiClient>');
    });
  });

  describe('end-to-end real-world examples', () => {
    it('handles a GitHub API GET', () => {
      const code = service.convert(
        `curl -H 'Accept: application/vnd.github+json' https://api.github.com/repos/octocat/hello-world`,
        defaultOptions,
      );
      expect(code).toContain('HttpMethod.Get');
      expect(code).toContain('Headers.Accept.Add');
      expect(code).toContain('application/vnd.github+json');
    });

    it('handles a Stripe-style POST with form data', () => {
      const code = service.convert(
        `curl -u sk_test_xyz: https://api.stripe.com/v1/charges -d 'amount=2000' -d 'currency=usd'`,
        defaultOptions,
      );
      expect(code).toContain('AuthenticationHeaderValue("Basic"');
      expect(code).toContain('FormUrlEncodedContent');
    });

    it('handles a multi-line PUT with bearer auth and JSON body', () => {
      const curl = `curl -X PUT 'https://api.example.com/orders/42' \\
        -H 'Authorization: Bearer abc' \\
        -H 'Content-Type: application/json' \\
        -d '{"status":"shipped","trackingNumber":"TRK-1"}'`;
      const code = service.convert(curl, {
        ...defaultOptions,
        wrapInAsyncMethod: true,
        generateBodyRecord: true,
      });
      expect(code).toContain('HttpMethod.Put');
      expect(code).toContain('public sealed record');
      expect(code).toContain('string Status');
      expect(code).toContain('string TrackingNumber');
      expect(code).toContain('AuthenticationHeaderValue("Bearer", "abc")');
    });
  });
});
