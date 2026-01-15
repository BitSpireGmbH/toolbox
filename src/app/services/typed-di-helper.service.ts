import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TypedDiHelperService {
  generateHttpCode(options: {
    serviceName: string;
    interfaceName: string;
    baseUrl: string;
    timeout: number;
    useResilience: boolean;
  }): string {
    const service = options.serviceName || 'MyApiService';
    const iface = options.interfaceName || `I${service}`;
    const url = options.baseUrl || 'https://api.example.com';
    const timeout = options.timeout || 30;

    let registration = `builder.Services.AddHttpClient<${iface}, ${service}>(client =>
{
    client.BaseAddress = new Uri("${url}");
    client.Timeout = TimeSpan.FromSeconds(${timeout});
});`;

    if (options.useResilience) {
      registration += `\n\n// Add standard resilience (Retry, Circuit Breaker, etc.)
// See: https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience
// Requires Microsoft.Extensions.Http.Resilience
builder.Services.AddHttpClient<${iface}, ${service}>()
    .AddStandardResilienceHandler();`;
    }

    return `// 1. Define the Client Interface
public interface ${iface}
{
    Task<string> GetDataAsync();
}

// 2. Implement the Client
public class ${service} : ${iface}
{
    private readonly HttpClient _httpClient;

    public ${service}(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> GetDataAsync()
    {
        return await _httpClient.GetStringAsync("endpoint");
    }
}

// 3. Register in Program.cs (DI)
${registration}`;
  }

  generateSignalRCode(options: {
    hubName: string;
    interfaceName: string;
    route: string;
    enableDetailedErrors: boolean;
    useMessagePack: boolean;
  }): string {
    const hub = options.hubName || 'ChatHub';
    const iface = options.interfaceName || `I${hub}Client`;
    const route = options.route || '/chat';

    let sigrOptions = '';
    if (options.enableDetailedErrors) {
      sigrOptions += `\n    options.EnableDetailedErrors = true;`;
    }

    let signalRRegistration = `builder.Services.AddSignalR(${sigrOptions ? `options =>\n{${sigrOptions}\n}` : ''});`;
    if (options.useMessagePack) {
      signalRRegistration += `\n    .AddMessagePackProtocol();`;
    }

    return `// 1. Define the Client Interface
public interface ${iface}
{
    Task ReceiveMessage(string user, string message);
}

// 2. Implement the Strongly-typed Hub
public class ${hub} : Hub<${iface}>
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.ReceiveMessage(user, message);
    }
}

// 3. Register in Program.cs
${signalRRegistration}

// 4. Map the Hub
app.MapHub<${hub}>("${route}");

// Usage in Service: IHubContext<${hub}, ${iface}> hubContext`;
  }
}
