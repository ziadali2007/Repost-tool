import React from "react";

export function useChatScroll<T>(
  dep: T,
): React.RefObject<HTMLDivElement | null> {
  const ref = React.useRef<HTMLDivElement>(null);

  // Scroll when dependency changes
  React.useLayoutEffect(() => {
    if (ref.current) {
      // Use setTimeout to allow DOM to update before calculating scrollHeight
      console.log(ref.current);
      if (ref.current) {
        console.log("Scrolling to bottom");
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    }
  }, [dep]); // Effect runs when 'dep' changes

  return ref;
}
