let cropper = null;
window.croppedImageBase64 = null;

window.openCropper = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('cropImage').src = e.target.result;
    
    // Popup Modal dikhayein
    document.getElementById('cropModal').style.display = 'block';
    document.getElementById('cropBox').style.display = 'block';
    document.getElementById('cropButtons').style.display = 'flex';
    
    // Agar loader hai toh use chhupa dein
    const loader = document.getElementById('aiLoader');
    if(loader) loader.style.display = 'none';

    if (cropper) cropper.destroy();
    cropper = new Cropper(document.getElementById('cropImage'), {
      aspectRatio: 1, // Perfect Square
      viewMode: 1,
      background: false
    });
  };
  reader.readAsDataURL(file);
};

window.confirmCrop = function() {
  if (!cropper) return;
  
  // 1. Cropped photo nikalna (Transparent background ke sath)
  const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
  
  // 2. Pichhe Pastel Blue (#eff6ff) color lagana
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 400;
  finalCanvas.height = 400;
  const ctx = finalCanvas.getContext('2d');
  
  ctx.fillStyle = '#eff6ff'; // Premium Light Blue Color
  ctx.fillRect(0, 0, 400, 400);
  ctx.drawImage(canvas, 0, 0); // Blue ke upar photo chipkana

  // 3. Final image save karna
  window.croppedImageBase64 = finalCanvas.toDataURL("image/jpeg", 0.9);

  // 4. Form mein choti photo ka preview dikhana
  const inputEl = document.querySelector('input[type="file"]:focus') || document.getElementById('studentPhoto') || document.getElementById('ePhoto');
  let preview = document.getElementById('photoPreview');
  
  if(!preview && inputEl) {
    preview = document.createElement('img');
    preview.id = 'photoPreview';
    preview.style = "width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin-top: 10px; border: 2px solid var(--primary); display: block;";
    inputEl.parentElement.appendChild(preview);
  }
  if(preview) preview.src = window.croppedImageBase64;

  document.getElementById('cropModal').style.display = 'none';
};

window.closeCropper = function() {
  document.getElementById('cropModal').style.display = 'none';
  if (cropper) cropper.destroy();
};
