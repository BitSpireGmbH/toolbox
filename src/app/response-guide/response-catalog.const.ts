import { ResponseEntry } from './models/response-entry.models';

/**
 * Every entry the Response Guide shows.
 *
 * This is deliberately the only file you need to touch to add a status code:
 * the component filters and renders whatever is in here, so a new scenario is
 * a new object, never a code change. Keep `id` unique - the integrity spec
 * enforces it.
 */
export const RESPONSE_CATALOG: ResponseEntry[] = [
  // ---------------------------------------------------------------------
  // Everyday scenarios
  // ---------------------------------------------------------------------
  {
    id: 'get-by-id',
    kind: 'scenario',
    title: 'Get a resource by id',
    statusCodes: ['200', '404'],
    tags: ['get', 'read', 'fetch', 'found', 'not found', 'ok'],
    standard: 'standard',
    summary: 'The default read endpoint: return the resource, or 404 when it does not exist.',
    snippets: {
      controller: `[HttpGet("{id:int}")]
public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
{
    var product = await _repo.FindAsync(id, ct);
    if (product is null)
        return NotFound();

    return Ok(product.ToDto());
}`,
      minimalApi: `app.MapGet("/products/{id:int}", async Task<Results<Ok<ProductDto>, NotFound>> (
    int id, IProductRepo repo, CancellationToken ct) =>
{
    var product = await repo.FindAsync(id, ct);
    return product is null
        ? TypedResults.NotFound()
        : TypedResults.Ok(product.ToDto());
});`,
      avoidNote: `// Compiles, but the endpoint's return type is just IResult, so:
//   - OpenAPI cannot infer the 200 body shape
//   - tests can only assert on the runtime type, not the signature
//   - adding a third outcome later is a silent change
app.MapGet("/products/{id:int}", async (int id, IProductRepo repo) =>
{
    var product = await repo.FindAsync(id);
    return product is null
        ? Results.NotFound()
        : Results.Ok(product.ToDto());
});`,
    },
  },
  {
    id: 'create-resource',
    kind: 'scenario',
    title: 'Create a resource',
    statusCodes: ['201'],
    tags: ['create', 'post', 'created', 'location', 'insert'],
    standard: 'standard',
    summary: '201 with a Location header pointing at the resource you just made.',
    snippets: {
      controller: `[HttpPost]
public async Task<ActionResult<ProductDto>> Create(CreateProductRequest req, CancellationToken ct)
{
    var product = await _repo.AddAsync(req.ToEntity(), ct);

    // CreatedAtAction writes the Location header for you - don't hand-roll it.
    return CreatedAtAction(nameof(GetById), new { id = product.Id }, product.ToDto());
}`,
      minimalApi: `app.MapPost("/products", async Task<Results<Created<ProductDto>, ValidationProblem>> (
    CreateProductRequest req, IProductRepo repo, CancellationToken ct) =>
{
    var product = await repo.AddAsync(req.ToEntity(), ct);
    return TypedResults.Created($"/products/{product.Id}", product.ToDto());
});`,
      avoidNote: `// Loses the typed "a 201 returns a ProductDto" contract.
return Results.Created($"/products/{product.Id}", product.ToDto());`,
    },
  },
  {
    id: 'validation-failure',
    kind: 'scenario',
    title: 'Validation failure',
    statusCodes: ['400', '422'],
    tags: ['validation', 'invalid', 'bad request', 'problem details', 'modelstate'],
    standard: 'standard',
    summary: 'Reject malformed input with a ProblemDetails body describing each field.',
    snippets: {
      controller: `[HttpPost]
public async Task<ActionResult> Create(CreateProductRequest req, CancellationToken ct)
{
    // With [ApiController] this is automatic - the filter short-circuits
    // before the action runs. Write it out only when you need custom errors.
    if (!ModelState.IsValid)
        return ValidationProblem(ModelState);

    await _repo.AddAsync(req.ToEntity(), ct);
    return NoContent();
}`,
      minimalApi: `app.MapPost("/products", async Task<Results<Created, ValidationProblem>> (
    CreateProductRequest req, IValidator<CreateProductRequest> validator, IProductRepo repo) =>
{
    var result = await validator.ValidateAsync(req);
    if (!result.IsValid)
        return TypedResults.ValidationProblem(result.ToDictionary());

    var product = await repo.AddAsync(req.ToEntity());
    return TypedResults.Created($"/products/{product.Id}");
});`,
      avoidNote: `// Untyped IResult again - OpenAPI won't document the 400 shape.
return Results.ValidationProblem(errors);`,
    },
  },
  {
    id: 'no-content-update',
    kind: 'scenario',
    title: 'No content on update',
    statusCodes: ['204', '404'],
    tags: ['update', 'put', 'patch', 'delete', 'no content', 'empty'],
    standard: 'standard',
    summary: 'A successful write that has nothing useful to return.',
    snippets: {
      controller: `[HttpPut("{id:int}")]
public async Task<IActionResult> Update(int id, UpdateProductRequest req, CancellationToken ct)
{
    var updated = await _repo.UpdateAsync(id, req, ct);
    return updated ? NoContent() : NotFound();
}`,
      minimalApi: `app.MapPut("/products/{id:int}", async Task<Results<NoContent, NotFound>> (
    int id, UpdateProductRequest req, IProductRepo repo, CancellationToken ct) =>
{
    var updated = await repo.UpdateAsync(id, req, ct);
    return updated ? TypedResults.NoContent() : TypedResults.NotFound();
});`,
      avoidNote: `return updated ? Results.NoContent() : Results.NotFound();`,
    },
  },
  {
    id: 'auth-failures',
    kind: 'scenario',
    title: 'Unauthorized vs. forbidden',
    statusCodes: ['401', '403'],
    tags: ['auth', 'unauthorized', 'forbidden', 'security', 'claims', 'policy'],
    standard: 'standard',
    summary: '401 means "I do not know who you are". 403 means "I do, and you may not".',
    snippets: {
      controller: `[HttpDelete("{id:int}")]
[Authorize(Policy = "CanDeleteProducts")]
public async Task<IActionResult> Delete(int id, CancellationToken ct)
{
    // Reaching here means the caller is authenticated, so a failure below
    // is 403 (Forbid), never 401.
    if (!User.HasClaim("scope", "products.write"))
        return Forbid();

    await _repo.DeleteAsync(id, ct);
    return NoContent();
}`,
      minimalApi: `app.MapDelete("/products/{id:int}", async Task<Results<NoContent, ForbidHttpResult>> (
    int id, ClaimsPrincipal user, IProductRepo repo, CancellationToken ct) =>
{
    if (!user.HasClaim("scope", "products.write"))
        return TypedResults.Forbid();

    await repo.DeleteAsync(id, ct);
    return TypedResults.NoContent();
}).RequireAuthorization("CanDeleteProducts");`,
      avoidNote: `// Works, but nothing ties the response back to the policy at compile time.
return Results.Forbid();`,
    },
  },
  {
    id: 'multiple-outcomes',
    kind: 'scenario',
    title: 'Multiple possible outcomes',
    statusCodes: ['200', '404', '409'],
    tags: ['union', 'multiple', 'outcomes', 'conflict', 'switch', 'typedresults'],
    standard: 'standard',
    summary: 'The strongest argument for TypedResults: the signature lists every response.',
    snippets: {
      controller: `[HttpPost("{id:int}/publish")]
public async Task<IActionResult> Publish(int id, CancellationToken ct)
{
    var result = await _svc.PublishAsync(id, ct);
    return result switch
    {
        { NotFound: true } => NotFound(),
        { Conflict: true } => Conflict(result.Reason),
        _ => Ok(result.Dto),
    };
}`,
      minimalApi: `app.MapPost("/products/{id:int}/publish",
    async Task<Results<Ok<ProductDto>, NotFound, Conflict<string>>> (
        int id, IProductService svc, CancellationToken ct) =>
{
    var result = await svc.PublishAsync(id, ct);
    return result switch
    {
        { NotFound: true } => TypedResults.NotFound(),
        { Conflict: true } => TypedResults.Conflict(result.Reason),
        _ => TypedResults.Ok(result.Dto),
    };
});`,
      avoidNote: `// This is the case TypedResults exists for. The union return type documents
// all three responses in the signature, and the compiler rejects a fourth one
// you forgot to declare. Plain Results/IResult cannot express any of that.`,
    },
  },

  // ---------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------
  {
    id: 'rate-limited',
    kind: 'scenario',
    title: 'Rate limited',
    statusCodes: ['429'],
    tags: ['rate limit', 'throttle', 'too many requests', 'retry-after', 'backoff', 'quota'],
    standard: 'standard',
    summary:
      'The code matters less than the Retry-After header - that is what callers need to back off correctly.',
    snippets: {
      controller: `[HttpGet]
[EnableRateLimiting("per-user")]
public async Task<ActionResult<IReadOnlyList<ReportDto>>> List(CancellationToken ct)
    => Ok(await _reports.ListAsync(ct));

// Program.cs - the Retry-After contract lives with the limiter, not the action.
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("per-user", o =>
    {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        // Without this header a caller can only guess, and will usually retry
        // far too aggressively. Emit it whenever the window is known.
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);

        await context.HttpContext.Response.WriteAsync("Rate limit exceeded.", token);
    };
});`,
      minimalApi: `app.MapGet("/reports", async (IReportService reports, CancellationToken ct)
    => TypedResults.Ok(await reports.ListAsync(ct)))
   .RequireRateLimiting("per-user");

// Returning 429 yourself - e.g. a business quota rather than a request rate:
app.MapPost("/reports/export",
    async Task<Results<Accepted, StatusCodeHttpResult>> (
        IQuotaService quota, HttpContext ctx) =>
{
    if (!quota.TryConsume(ctx.User, out var retryAfter))
    {
        ctx.Response.Headers.RetryAfter =
            ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return TypedResults.StatusCode(StatusCodes.Status429TooManyRequests);
    }

    return TypedResults.Accepted("/reports/export/status");
});`,
      avoidNote: `// Returning 429 with no Retry-After is the common mistake. It is technically
// valid, but every caller now has to invent its own backoff, and the impatient
// ones will hammer you exactly when you are already overloaded.
return Results.StatusCode(429);`,
    },
  },

  // ---------------------------------------------------------------------
  // Client gave up / timeouts
  // ---------------------------------------------------------------------
  {
    id: 'request-timeout',
    kind: 'scenario',
    title: 'Client took too long to send the request',
    statusCodes: ['408'],
    tags: ['timeout', 'request timeout', 'slow client', 'kestrel', 'slowloris'],
    standard: 'standard',
    summary: 'Configured on Kestrel rather than returned by hand. Contrast with 499.',
    snippets: {
      controller: `// You almost never write 408 in an action - Kestrel enforces it from these
// limits, which also blunt slow-loris style attacks.
builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    o.Limits.MinRequestBodyDataRate = new MinDataRate(
        bytesPerSecond: 100,
        gracePeriod: TimeSpan.FromSeconds(10));
});`,
      minimalApi: `// Same Kestrel configuration - it is a host concern, not an endpoint one.
// Per-endpoint deadlines are a different feature (.NET 8+ request timeouts):
builder.Services.AddRequestTimeouts(o =>
{
    o.DefaultPolicy = new RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(30),
        TimeoutStatusCode = StatusCodes.Status408RequestTimeout,
    };
});

app.UseRequestTimeouts();

app.MapGet("/slow-report", async (IReportService reports, CancellationToken ct)
    => TypedResults.Ok(await reports.BuildAsync(ct)))
   .WithRequestTimeout(TimeSpan.FromSeconds(10));`,
    },
  },

  // ---------------------------------------------------------------------
  // Upstream / gateway failures
  // ---------------------------------------------------------------------
  {
    id: 'gateway-timeout',
    kind: 'scenario',
    title: 'Downstream service did not respond in time',
    statusCodes: ['504'],
    tags: ['timeout', 'gateway timeout', 'upstream', 'downstream', 'httpclient', 'slow'],
    standard: 'standard',
    summary:
      '504 is "I gave up waiting". Use it when you are the gateway and your dependency stalled.',
    snippets: {
      controller: `[HttpGet("{id:int}/pricing")]
public async Task<ActionResult<PricingDto>> GetPricing(int id, CancellationToken ct)
{
    try
    {
        return Ok(await _pricing.GetAsync(id, ct));
    }
    // HttpClient.Timeout surfaces as TaskCanceledException. The guard matters:
    // without it you would also return 504 when the *caller* disconnected,
    // which is a 499 in the log and not your dependency's fault at all.
    catch (TaskCanceledException) when (!ct.IsCancellationRequested)
    {
        _logger.LogWarning("Pricing service timed out for product {ProductId}", id);
        return StatusCode(StatusCodes.Status504GatewayTimeout);
    }
}`,
      minimalApi: `app.MapGet("/products/{id:int}/pricing",
    async Task<Results<Ok<PricingDto>, StatusCodeHttpResult>> (
        int id, IPricingClient pricing, ILogger<Program> logger, CancellationToken ct) =>
{
    try
    {
        return TypedResults.Ok(await pricing.GetAsync(id, ct));
    }
    catch (TaskCanceledException) when (!ct.IsCancellationRequested)
    {
        // 504, not 503: we are up, our dependency is the one that stalled.
        logger.LogWarning("Pricing service timed out for product {ProductId}", id);
        return TypedResults.StatusCode(StatusCodes.Status504GatewayTimeout);
    }
});`,
      avoidNote: `// Do not collapse a downstream timeout into a 500. A 500 tells the caller
// "this request is broken, don't bother retrying"; a 504 tells it "transient,
// retry with backoff". They drive completely different client behaviour.
catch (TaskCanceledException) { return Results.StatusCode(500); }`,
    },
  },
  {
    id: 'bad-gateway',
    kind: 'scenario',
    title: 'Downstream returned something invalid',
    statusCodes: ['502'],
    tags: ['bad gateway', 'upstream', 'downstream', 'malformed', 'contract', 'json'],
    standard: 'standard',
    summary: 'The dependency answered, but not with anything you can use.',
    snippets: {
      controller: `[HttpGet("{id:int}/pricing")]
public async Task<ActionResult<PricingDto>> GetPricing(int id, CancellationToken ct)
{
    try
    {
        return Ok(await _pricing.GetAsync(id, ct));
    }
    // The upstream replied, but broke its own contract - unparseable body,
    // or a status you have no mapping for. That is 502, not 500.
    catch (JsonException ex)
    {
        _logger.LogError(ex, "Pricing service returned an unreadable payload");
        return StatusCode(StatusCodes.Status502BadGateway);
    }
}`,
      minimalApi: `app.MapGet("/products/{id:int}/pricing",
    async Task<Results<Ok<PricingDto>, StatusCodeHttpResult>> (
        int id, IPricingClient pricing, ILogger<Program> logger, CancellationToken ct) =>
{
    try
    {
        return TypedResults.Ok(await pricing.GetAsync(id, ct));
    }
    catch (JsonException ex)
    {
        logger.LogError(ex, "Pricing service returned an unreadable payload");
        return TypedResults.StatusCode(StatusCodes.Status502BadGateway);
    }
});`,
    },
  },
  {
    id: 'service-unavailable',
    kind: 'scenario',
    title: 'Server overloaded or intentionally down',
    statusCodes: ['503'],
    tags: ['maintenance', 'service unavailable', 'overload', 'retry-after', 'draining', 'health'],
    standard: 'standard',
    summary: '503 is "I know I am down". Carry Retry-After whenever you know the window.',
    snippets: {
      controller: `[HttpGet]
public async Task<ActionResult<IReadOnlyList<OrderDto>>> List(CancellationToken ct)
{
    if (_maintenance.IsActive)
    {
        // Tell the caller when to come back. A bare 503 makes every client
        // guess, and they will all guess the same short interval.
        Response.Headers.RetryAfter = "300";
        return StatusCode(StatusCodes.Status503ServiceUnavailable);
    }

    return Ok(await _orders.ListAsync(ct));
}`,
      minimalApi: `app.MapGet("/orders", async Task<Results<Ok<IReadOnlyList<OrderDto>>, StatusCodeHttpResult>> (
    IOrderService orders, IMaintenanceState maintenance, HttpContext ctx, CancellationToken ct) =>
{
    if (maintenance.IsActive)
    {
        ctx.Response.Headers.RetryAfter = "300";
        return TypedResults.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }

    return TypedResults.Ok(await orders.ListAsync(ct));
});`,
      avoidNote: `// 503 vs 504 is the distinction people get wrong most often:
//   503 - "I know I'm down."         (you, deliberately or under load)
//   504 - "I gave up waiting."       (your dependency, silently)
// Returning 503 for a downstream timeout hides which service actually broke.`,
    },
  },
  {
    id: 'insufficient-storage',
    kind: 'scenario',
    title: 'Out of storage / infinite loop',
    statusCodes: ['507', '508'],
    tags: ['storage', 'disk', 'quota', 'loop detected', 'webdav', 'upload'],
    standard: 'webdav',
    summary: 'WebDAV in origin, but 507 is a reasonable answer to a full disk on upload.',
    snippets: {
      controller: `[HttpPost("attachments")]
public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
{
    if (!_storage.HasRoomFor(file.Length))
        return StatusCode(StatusCodes.Status507InsufficientStorage);

    await _storage.SaveAsync(file, ct);
    return NoContent();
}`,
      minimalApi: `app.MapPost("/attachments", async Task<Results<NoContent, StatusCodeHttpResult>> (
    IFormFile file, IStorageService storage, CancellationToken ct) =>
{
    if (!storage.HasRoomFor(file.Length))
        return TypedResults.StatusCode(StatusCodes.Status507InsufficientStorage);

    await storage.SaveAsync(file, ct);
    return TypedResults.NoContent();
}).DisableAntiforgery();

// 508 Loop Detected is rarer still - useful when resolving a self-referential
// graph (org charts, category trees) and you detect a cycle rather than
// recursing until the stack blows.`,
    },
  },

  // ---------------------------------------------------------------------
  // Reference only - codes you observe but never emit
  // ---------------------------------------------------------------------
  {
    id: 'client-closed-request',
    kind: 'reference',
    title: 'Client Closed Request',
    statusCodes: ['499'],
    tags: ['nginx', 'cancelled', 'client gone', 'disconnect', 'timeout', 'aborted'],
    standard: 'nginx',
    summary: 'nginx-only, but everywhere in logs: the caller hung up before you answered.',
    meaning:
      'A non-standard code nginx writes to its own access log when the client closed the connection before the server produced a response. It is never sent over the wire - nobody receives a 499, because by definition there is nobody left to receive it.',
    cause:
      'The caller cancelled, navigated away, or its own timeout fired before yours did. A sudden spike usually means an upstream caller has a shorter timeout than your endpoint takes to respond.',
    whatToDo:
      'In ASP.NET Core this is HttpContext.RequestAborted firing, surfacing as OperationCanceledException. Accept the cancellation token in your actions and let it propagate - do not catch and convert it into a 500. Crucially, do not report it as a 504 either: the difference between "my dependency stalled" and "my caller left" is the difference between fixing your backend and fixing the caller.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-499/',
  },
  {
    id: 'network-connect-timeout',
    kind: 'reference',
    title: 'Network Connect Timeout Error',
    statusCodes: ['599'],
    tags: ['aws', 'elb', 'proxy', 'tcp', 'connect', 'timeout', 'load balancer'],
    standard: 'aws',
    summary: 'Unofficial. Some proxies and AWS ELB logs use it when TCP never connected.',
    meaning:
      'Not in the IANA registry. Used by some proxies and load balancers - notably in AWS ELB logs - to record that the connection to the backend could not be established at all.',
    cause:
      'The TCP handshake never completed: no listener on the port, security group or NACL dropping the packets, the instance still booting, or the target failing health checks and being pulled from rotation.',
    whatToDo:
      'This is infrastructure, not application code. Check target group health, security groups, and whether the process is actually bound to the expected interface and port. Nothing in your ASP.NET Core app can produce or handle a 599 - if you see it, your request never reached the app.',
  },
  {
    id: 'enhance-your-calm',
    kind: 'reference',
    title: 'Enhance Your Calm',
    statusCodes: ['420'],
    tags: ['twitter', 'rate limit', 'legacy', 'non-standard', 'throttle'],
    standard: 'legacy',
    summary: 'A historical curiosity. Use 429 instead - this is here so you recognise it.',
    meaning:
      'A non-standard rate-limiting code originating from the Twitter API v1. It predates the standardisation of 429 and means roughly the same thing.',
    cause: 'You are talking to an older API that never migrated to 429.',
    whatToDo:
      'Recognise it and treat it as a 429 on the client side. Do not emit it from new code - this entry is documentation of something you may meet in the wild, explicitly not a recommendation.',
  },

  // ---------------------------------------------------------------------
  // Cloudflare 5xx
  // ---------------------------------------------------------------------
  {
    id: 'cf-unknown-error',
    kind: 'reference',
    title: 'Web Server Returns an Unknown Error',
    statusCodes: ['520'],
    tags: ['cloudflare', 'cdn', 'origin', 'unknown', 'empty response'],
    standard: 'cloudflare',
    summary: 'Cloudflare got a response from your origin that it could not make sense of.',
    meaning:
      'A catch-all Cloudflare emits when the origin returns an empty, unexpected, or malformed response - connection reset, a response with no status line, or headers that violate the spec.',
    cause:
      'Most often the origin crashed mid-response, sent an oversized header, or a process was killed while writing. 520 is the code Cloudflare falls back to when nothing more specific fits.',
    whatToDo:
      'Check origin logs around the exact timestamp - 520 carries no detail of its own. Look for OOM kills, worker restarts, and unusually large response headers (cookies are the usual culprit).',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/',
  },
  {
    id: 'cf-server-down',
    kind: 'reference',
    title: 'Web Server Is Down',
    statusCodes: ['521'],
    tags: ['cloudflare', 'cdn', 'origin', 'down', 'refused', 'blocked'],
    standard: 'cloudflare',
    summary: 'Your origin actively refused the connection from Cloudflare.',
    meaning:
      'Cloudflare reached your origin and the connection was refused outright, rather than timing out.',
    cause:
      'The web server process is stopped, or a firewall is rejecting Cloudflare IP ranges. Refused is the operative word - something answered "no", so this is rarely a network-path problem.',
    whatToDo:
      'Confirm the server process is running and listening, then allow the published Cloudflare IP ranges through your firewall. Blocking them wholesale is a common cause after a security hardening pass.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/',
  },
  {
    id: 'cf-connection-timed-out',
    kind: 'reference',
    title: 'Connection Timed Out',
    statusCodes: ['522'],
    tags: ['cloudflare', 'cdn', 'origin', 'timeout', 'tcp', 'handshake', 'downstream'],
    standard: 'cloudflare',
    summary: 'Your origin is the problem, not Cloudflare. The TCP handshake never completed.',
    meaning:
      'Cloudflare could not complete a TCP connection to your origin within its timeout. Unlike 521 nothing refused the connection - the packets simply went unanswered.',
    cause:
      'The origin is saturated and not accepting new connections, packets are being silently dropped by a firewall, or the origin IP in your DNS record is wrong or stale.',
    whatToDo:
      'This is one of the three Cloudflare codes that mean your origin or a downstream service is at fault, not the CDN. Check server load and connection limits, confirm the DNS record points where you think it does, and verify no firewall is dropping (rather than rejecting) Cloudflare traffic.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/',
  },
  {
    id: 'cf-origin-unreachable',
    kind: 'reference',
    title: 'Origin Is Unreachable',
    statusCodes: ['523'],
    tags: ['cloudflare', 'cdn', 'origin', 'unreachable', 'dns', 'routing', 'downstream'],
    standard: 'cloudflare',
    summary: 'Your origin is the problem, not Cloudflare. It could not be routed to at all.',
    meaning:
      'Cloudflare could not reach the origin server - there is no route to the host.',
    cause:
      'Usually a DNS record pointing at an IP that no longer exists (a rebuilt VM, a released elastic IP), or a routing/BGP problem between Cloudflare and your host.',
    whatToDo:
      'Another "your side, not Cloudflare" code. Verify the A/AAAA record matches the current origin IP - this breaks most often right after an infrastructure change that reassigned the address.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/',
  },
  {
    id: 'cf-timeout-occurred',
    kind: 'reference',
    title: 'A Timeout Occurred',
    statusCodes: ['524'],
    tags: ['cloudflare', 'cdn', 'origin', 'timeout', 'slow', 'long running', 'downstream'],
    standard: 'cloudflare',
    summary: 'Your origin is the problem, not Cloudflare. It connected, then answered too slowly.',
    meaning:
      'Cloudflare established a TCP connection to the origin but did not receive a complete HTTP response within its timeout window (100 seconds on most plans).',
    cause:
      'A genuinely long-running request - a big report, an unindexed query, or a synchronous call to a slow third party. This is the Cloudflare analogue of a 504, and the most common of the 52x family in practice.',
    whatToDo:
      'The third "your origin is at fault" code. The fix is architectural rather than configuration: move long work to a background job and return 202 Accepted with a status endpoint. Raising the timeout only defers the problem, and it is capped anyway.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/',
  },
  {
    id: 'cf-ssl-handshake-failed',
    kind: 'reference',
    title: 'SSL Handshake Failed',
    statusCodes: ['525'],
    tags: ['cloudflare', 'cdn', 'ssl', 'tls', 'handshake', 'cipher', 'certificate'],
    standard: 'cloudflare',
    summary: 'TLS negotiation between Cloudflare and your origin failed.',
    meaning: 'The TLS handshake between Cloudflare and the origin could not be completed.',
    cause:
      'No cipher suite in common, the origin is not configured for TLS on the port Cloudflare is using, or SNI is missing or mismatched.',
    whatToDo:
      'Check that the origin serves HTTPS on the expected port and shares at least one modern cipher suite with Cloudflare. This often appears right after disabling older TLS versions on the origin.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/',
  },
  {
    id: 'cf-invalid-ssl-certificate',
    kind: 'reference',
    title: 'Invalid SSL Certificate',
    statusCodes: ['526'],
    tags: ['cloudflare', 'cdn', 'ssl', 'tls', 'certificate', 'expired', 'full strict'],
    standard: 'cloudflare',
    summary: "Cloudflare could not validate your origin's certificate in Full (strict) mode.",
    meaning:
      "Cloudflare could not validate the certificate presented by the origin while the SSL/TLS mode is set to Full (strict).",
    cause:
      'The origin certificate is expired, self-signed, issued for a different hostname, or missing intermediate certificates in its chain.',
    whatToDo:
      'Install a valid certificate on the origin - a free Cloudflare Origin CA certificate is the usual answer. An expired certificate is by far the most common trigger, so check the expiry date first.',
    docsUrl:
      'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/',
  },
];
