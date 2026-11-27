export function displayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  return name === name.toLocaleLowerCase()
    ? name.replace(
        /(^|[\s-])(\p{L})/gu,
        (_, space: string, letter: string) =>
          space + letter.toLocaleUpperCase(),
      )
    : name;
}
