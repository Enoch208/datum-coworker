import { Fragment } from "react";

export function KeyText({ value }: { value: string }) {
  const parts = value.split(":");
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${String(index)}-${part}`}>
          {part}
          {index < parts.length - 1 && (
            <>
              :<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}
