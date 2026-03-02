 document.addEventListener("DOMContentLoaded", function () {
   const mainImage = document.getElementById("mainImage");
   const titleEl = document.getElementById("detailTitle");
   const descEl = document.getElementById("detailDesc");
   const thumbs = Array.from(document.querySelectorAll(".thumb-item"));
 
   // 切换缩略项
   thumbs.forEach((btn) => {
     btn.addEventListener("click", () => {
       const img = btn.getAttribute("data-image");
       const title = btn.getAttribute("data-title");
       const desc = btn.getAttribute("data-desc");
 
       // 更新主图和文字
       if (img) mainImage.src = img;
       if (title) titleEl.textContent = title;
       if (desc) descEl.textContent = desc;
 
       // 激活状态切换
       thumbs.forEach((b) => b.classList.remove("active"));
       btn.classList.add("active");
     });
   });
 
 });
