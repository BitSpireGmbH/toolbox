import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TypedDiHelperComponent } from './typed-di-helper';

describe('TypedDiHelperComponent', () => {
  let component: TypedDiHelperComponent;
  let fixture: ComponentFixture<TypedDiHelperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypedDiHelperComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TypedDiHelperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have http as default tab', () => {
    expect(component.activeTab()).toBe('http');
  });

  it('should switch to signalr tab', () => {
    component.activeTab.set('signalr');
    expect(component.activeTab()).toBe('signalr');
  });

  it('should generate http code by default', () => {
    const code = component.generatedCode();
    expect(code).toContain('builder.Services.AddHttpClient');
    expect(code).toContain('IMyApiService');
    expect(code).toContain('MyApiService');
    expect(code).toContain('https://api.example.com');
  });

  it('should update http code when signals change', () => {
    component.httpServiceName.set('CustomService');
    component.httpInterfaceName.set('ICustomService');
    component.httpBaseUrl.set('https://custom.api.com');
    component.httpTimeout.set(60);

    const code = component.generatedCode();
    expect(code).toContain('builder.Services.AddHttpClient<ICustomService, CustomService>');
    expect(code).toContain('new Uri("https://custom.api.com")');
    expect(code).toContain('TimeSpan.FromSeconds(60)');
  });

  it('should generate signalr code when tab is signalr', () => {
    component.activeTab.set('signalr');
    const code = component.generatedCode();
    expect(code).toContain('builder.Services.AddSignalR');
    expect(code).toContain('IChatClient');
    expect(code).toContain('ChatHub');
    expect(code).toContain('app.MapHub<ChatHub>("/chat")');
  });

  it('should update signalr code when signals change', () => {
    component.activeTab.set('signalr');
    component.signalRHubName.set('NotificationHub');
    component.signalRInterfaceName.set('INotificationClient');
    component.signalRRoute.set('/notifications');
    component.signalREnableDetailedErrors.set(true);
    component.signalRUseMessagePack.set(true);

    const code = component.generatedCode();
    expect(code).toContain('app.MapHub<NotificationHub>("/notifications")');
    expect(code).toContain('options.EnableDetailedErrors = true');
    expect(code).toContain('.AddMessagePackProtocol()');
  });

  it('should copy code to clipboard', async () => {
    const writeTextSpy = vi.fn().mockImplementation(() => Promise.resolve());
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextSpy
      }
    });

    component.copyCode();
    expect(writeTextSpy).toHaveBeenCalledWith(component.generatedCode());
    
    vi.unstubAllGlobals();
  });
});
