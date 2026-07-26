Generate a complete KBPro EventBus event with all required boilerplate.

Event name / description: $ARGUMENTS

## Before generating

1. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/maps/architecture-map.md`.
2. Read `Assets/KBPro/kbpro-ai-docs/kbpro-wiki/wiki/entities/event-bus.md`.
3. Grep `Assets/Core/Scripts/Events/` and nearby modules for existing event conventions in this project. Match the naming pattern and base type exactly.

## What to generate

### 1. Event message class
```
Assets/Core/Scripts/Events/{EventName}.cs
```
- Implement `IEvent` or inherit the project's base event type if one exists.
- Public readonly fields for all relevant data.
- Namespace matching surrounding event files.

### 2. Publisher snippet
Show exactly how to raise the event:
```csharp
EventBus<{EventName}>.Raise(new {EventName} { ... });
```

### 3. Subscriber snippet
Show the complete subscription pattern for a `LogicSystem` or `GameComponent`:
```csharp
private EventBinding<{EventName}> _{fieldName};

// In Initialize:
_{fieldName} = new EventBinding<{EventName}>(On{EventName});
EventBus<{EventName}>.Register(_{fieldName});

// In Dispose:
EventBus<{EventName}>.Unregister(_{fieldName});

private void On{EventName}({EventName} e) { }
```

## After generating

- Show where to place the event file.
- Remind to run `git status --short` after creation.
