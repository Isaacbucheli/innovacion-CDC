import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        // Marca Business IT: superficie clara + tipografía/colores del brandbook.
        // Verde #A3C243 como acento POSITIVO (éxito/carga); rojo y ámbar funcionales
        // para error/aviso; gris #606161 para info. Acento como barra izquierda + icono.
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-lg group-[.toaster]:shadow-lg",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[#A3C243] [&_[data-icon]]:text-[#A3C243]",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive [&_[data-icon]]:text-destructive",
          warning:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-amber-500 [&_[data-icon]]:text-amber-500",
          info:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[#606161] [&_[data-icon]]:text-[#606161] dark:group-[.toaster]:border-l-[#9a9a9a] dark:[&_[data-icon]]:text-[#9a9a9a]",
          loading: "[&_[data-icon]]:text-[#A3C243]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
