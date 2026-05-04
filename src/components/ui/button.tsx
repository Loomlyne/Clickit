import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[24px] text-[13.5px] font-medium whitespace-nowrap transition-[transform,background,border-color] duration-[120ms] ease-[var(--ease)] outline-none active:scale-[0.97] active:duration-75 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 border border-transparent",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-white",
        destructive:
          "border-destructive/70 bg-destructive/90 text-white hover:bg-destructive focus-visible:ring-destructive/20",
        outline:
          "border-[var(--line-2)] text-foreground hover:bg-white/[0.04]",
        ghost:
          "bg-white/[0.08] border-white/[0.08] text-foreground backdrop-blur-[8px] hover:bg-white/[0.14] hover:border-[var(--line-2)]",
        secondary:
          "border-white/8 bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        link: "rounded-none border-none bg-transparent px-0 text-primary shadow-none hover:text-primary hover:underline underline-offset-4",
      },
      size: {
        default: "px-[18px] py-2.5",
        xs: "px-2.5 py-1 text-xs gap-1",
        sm: "px-3 py-[7px] text-[12.5px] gap-1.5",
        lg: "px-[26px] py-3.5 text-[15px]",
        icon: "size-9 rounded-full p-0",
        "icon-xs": "size-7 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-11 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
