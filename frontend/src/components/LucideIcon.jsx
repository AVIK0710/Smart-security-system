import * as Icons from "lucide-react";

export default function LucideIcon({ name, size = 18, ...props }) {
  const Icon = Icons[name] || Icons.Circle;
  return <Icon size={size} {...props} />;
}
