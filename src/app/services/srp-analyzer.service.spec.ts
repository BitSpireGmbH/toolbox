import { describe, it, expect, beforeEach } from 'vitest';
import { SrpAnalyzerService } from './srp-analyzer.service';

describe('SrpAnalyzerService', () => {
  let service: SrpAnalyzerService;

  beforeEach(() => {
    service = new SrpAnalyzerService();
  });

  it('should not identify "public" or "class" as dependencies in the provided code', () => {
    const code = `
using Api.Authorization;
using Application.Processes;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers.Processes;

[ApiController]
[Route("api/process")]
public class ProcessController : ControllerBase
{
    private readonly IA _a;
    private readonly IB _b;
    private readonly IC _c;

    public ProcessController(
        IA a,
        IB b,
        IC c)
    {
        _a = a;
        _b = b;
        _c = c;
    }

    [HttpGet("workpieces/{machineNumber:int}")]
    public async Task<IReadOnlyCollection<WorkpieceModel>> GetWorkpieces([FromRoute] int machineNumber, CancellationToken token)
    {
        return await _a.GetWorkpieces(machineNumber, token);
    }
}`;

    const result = service.analyzeCode(code, true);

    const dependencyTypes = result.dependencies.map(d => d.type);
    expect(dependencyTypes).not.toContain('public');
    expect(dependencyTypes).not.toContain('class');
    expect(dependencyTypes).toContain('IA');
    expect(dependencyTypes).toContain('IB');
    expect(dependencyTypes).toContain('IC');

    expect(result.methodUsages.length).toBeGreaterThan(0);

    const highlighted = service.highlightCode(code, result, null);
    // Check for method wrapper
    expect(highlighted).toContain('class="srp-method"');
  });

  it('should highlight methods with background color', () => {
    const code = `
public class Processor
{
    private readonly IOrderService _orderService;

    public Processor(IOrderService orderService)
    {
        _orderService = orderService;
    }

    public void ProcessOrder(Order order)
    {
        _orderService.Process(order);
    }
}`;
    const result = service.analyzeCode(code, true);
    const highlighted = service.highlightCode(code, result, null);

    // Check for method wrapper
    expect(highlighted).toContain('class="srp-method"');
    // Check for dependency highlight
    expect(highlighted).toContain('class="srp-highlight"');
  });

  /*
   * The method wrapper is a full-width inline-block, so it cannot share a line
   * with anything before it. Open it on the blank line between two methods and
   * it wraps to a line of its own, pushing every character inside it one line
   * down from where the same character sits in the Prism layer and the
   * textarea stacked with it - which shows up as dependency tints painted a
   * line below the identifiers they belong to.
   */
  it('opens the method wrapper on the method, not on the blank line above it', () => {
    const code = `
public class Processor
{
    private readonly IOrderService _orderService;

    public Processor(IOrderService orderService)
    {
        _orderService = orderService;
    }

    public void ProcessOrder(Order order)
    {
        _orderService.Process(order);
    }
}`;
    const result = service.analyzeCode(code, true);
    const highlighted = service.highlightCode(code, result, null);

    const openings = [...highlighted.matchAll(/<span class="srp-method"[^>]*>/g)];
    expect(openings.length).toBeGreaterThan(0);

    for (const opening of openings) {
      const after = highlighted.slice(opening.index + opening[0].length);
      expect(after.startsWith('\n'), 'method wrapper must not open on a newline').toBe(false);
    }
  });

  it('should correctly scope method bodies (no incorrect nesting with expression bodies)', () => {
    const code = `
public class Test
{
    private readonly IDep _dep;
    public Test(IDep dep) { _dep = dep; }

    public void Method1()
    {
        _dep.Do();
    }

    public int Method2() => 42;
}
`;
    const result = service.analyzeCode(code, true);

    // Method1 should be found
    const method1 = result.methodUsages.find(m => m.methodName === 'Method1');
    expect(method1).toBeDefined();
    if (!method1) return; // Type guard for TypeScript

    // Method1 body should NOT contain Method2
    const method1Body = code.substring(method1.startIndex, method1.endIndex);
    expect(method1Body).not.toContain('Method2');
    expect(method1Body).not.toContain('=> 42');
  });
});
