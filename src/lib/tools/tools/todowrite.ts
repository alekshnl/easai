export async function executeTodowrite(
  args: { todos: Array<{ content: string; status: string; priority?: string }> },
): Promise<string> {
  if (!args.todos || !Array.isArray(args.todos)) {
    return "Error: todos array is required";
  }

  const summary = args.todos
    .map((t) => {
      const icon = t.status === "completed" ? "x" : t.status === "in_progress" ? ">" : " ";
      const priority = t.priority === "high" ? "!" : t.priority === "medium" ? "~" : " ";
      return `[${icon}] [${priority}] ${t.content}`;
    })
    .join("\n");

  return `Todo list updated:\n${summary}`;
}
