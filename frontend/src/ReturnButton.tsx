import { CornerUpLeft } from "lucide-react";
import Button, { type ButtonProps } from "./Button";

export default function ReturnButton({ children, size = "compact", ...props }: Omit<ButtonProps, "variant">) {
  return <Button {...props} variant="return" size={size}>
    <CornerUpLeft size={18} aria-hidden="true" />{children}
  </Button>;
}
