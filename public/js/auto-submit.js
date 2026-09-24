document.querySelectorAll("select.auto-submit").forEach(function (select) {
  select.addEventListener("change", function () {
    select.form.submit();
  });
});
