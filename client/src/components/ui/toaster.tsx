import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import astronautAvatar from "@assets/E2C9617D-45A3-4B6C-AAFC-BE05B63ADC44_1764889729769.png"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isSuccess = props.variant === "success"
        return (
          <Toast key={id} {...props} className={isSuccess ? "pr-20" : undefined}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            {isSuccess && (
              <img 
                src={astronautAvatar} 
                alt="Astronaute Planbase" 
                className="absolute bottom-0 right-2 w-16 h-16 object-contain"
                data-testid="img-astronaut-avatar"
              />
            )}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
