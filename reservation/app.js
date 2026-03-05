document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("reservationForm");
  const toast = document.getElementById("toast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("toast--show");
    setTimeout(() => {
      toast.classList.remove("toast--show");
    }, 2200);
  }

  function setError(fieldName, message) {
    const errorEl = document.querySelector(
      `.error[data-error-for="${fieldName}"]`
    );
    if (errorEl) {
      errorEl.textContent = message || "";
    }
  }

  function clearErrors() {
    document
      .querySelectorAll(".error[data-error-for]")
      .forEach((el) => (el.textContent = ""));
  }

  function validate(formData) {
    let valid = true;
    clearErrors();

    const name = formData.get("name").trim();
    if (!name) {
      setError("name", "请输入姓名");
      valid = false;
    }

    const phone = formData.get("phone").trim();
    const phoneReg = /^1\d{10}$/;
    if (!phone) {
      setError("phone", "请输入联系电话");
      valid = false;
    } else if (!phoneReg.test(phone)) {
      setError("phone", "请输入有效的手机号（11位数字）");
      valid = false;
    }

    const dateStr = formData.get("date");
    if (!dateStr) {
      setError("date", "请选择预约日期");
      valid = false;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(dateStr);
      if (selected < today) {
        setError("date", "预约日期不能早于今天");
        valid = false;
      }
    }

    const quantityStr = formData.get("quantity");
    if (quantityStr) {
      const quantity = Number(quantityStr);
      if (Number.isNaN(quantity) || quantity < 1 || quantity > 50) {
        setError("quantity", "人数需为 1-50 之间的数字");
        valid = false;
      }
    }

    return valid;
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(form);

      if (!validate(formData)) {
        showToast("请先修正表单中的错误");
        return;
      }

      // 这里可以替换为实际的接口调用
      console.log("预约数据：", Object.fromEntries(formData.entries()));

      showToast("预约提交成功，我们将尽快与您联系");
      form.reset();
    });
  }
});

