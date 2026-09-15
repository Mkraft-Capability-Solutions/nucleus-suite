function toNeonQuery(queryStr: string, params: any[]) {
  const parts = queryStr.split(/\$\d+/);
  (parts as any).raw = parts;
  return { parts, params }; // just to see what it outputs
}
console.log(toNeonQuery("SELECT * FROM t WHERE a = $1 AND b = $2", ["foo", "bar"]));
