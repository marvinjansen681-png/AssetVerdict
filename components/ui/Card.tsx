import { HTMLAttributes } from "react";
import clsx from "clsx";

export default function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-white border border-av-light-grey rounded-lg shadow-sm hover:shadow-md transition-shadow",
        className
      )}
      {...props}
    />
  );
}
