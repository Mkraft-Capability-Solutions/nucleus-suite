fetch("http://localhost:3000/api/v1/ops/modules/statutory_register/records")
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
