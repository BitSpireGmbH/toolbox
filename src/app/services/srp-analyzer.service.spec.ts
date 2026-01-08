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
});
