"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#3D6B3D] group-[.toaster]:text-white group-[.toaster]:border-0 group-[.toaster]:rounded-xl group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-white/80",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
