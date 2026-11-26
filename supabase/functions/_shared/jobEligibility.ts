export function explicitlyAcceptsFreshers(requirement: string | null) {
  const text = requirement ?? "";
  if (
    /no freshers?|not (?:open |suitable |eligible )?(?:to |for )?freshers?|freshers?.{0,24}(?:not eligible|cannot apply|not allowed)|experienced (?:candidates? )?only/i.test(
      text,
    )
  )
    return false;
  return text.split(/\n|(?<=[.!?])\s+/).some(line => {
    if (/\b(?:train(?:ing)?|manag(?:e|ing)|mentor(?:ing)?|supervis(?:e|ing))\b.{0,80}\bfreshers?\b|\bfreshers?\s+who\s+(?:joined|work|have joined)|\b(?:salary|compensation)\b/i.test(line)) return false;
    return /\bno (?:prior |previous |professional |prior professional |previous professional )?experience\b|\b0\s*(?:years?|(?:[-–]|to)\s*\d+\s*years?)\b/i.test(line) || /\bfreshers?(?:\s+(?:welcome|eligible|can|may|with|or|from|are|wanted)|[:.,()\/]|$)/i.test(line);
  });
}
