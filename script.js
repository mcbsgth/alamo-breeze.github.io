// ===================================================================
// ส่วนที่ 1: การตั้งค่าและการประกาศตัวแปร Global
// ===================================================================

// *** สำคัญ! เปลี่ยน URL นี้ด้วย Deployment URL ของ Google Apps Script ของคุณ ***
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxhl5GswROA0TkGHQekfUvt75kNlWB7F8daCrNOKZbTmiwtNo06Do9ga3xA9kTfrssK/exec"; 

let allProducts = []; // เก็บข้อมูลสินค้าทั้งหมดที่ดึงมาจาก Google Sheet
let cart = {}; // เก็บสถานะตะกร้าสินค้า เช่น {SKU1: {item: {...}, quantity: 2}}

// ===================================================================
// ส่วนที่ 2: การอ้างอิงองค์ประกอบ DOM (ต้องหา ID ให้เจอ)
// ===================================================================

// ** 2.1 Navigation **
const navPosBtn = document.getElementById('nav-pos');
const navReportsBtn = document.getElementById('nav-reports');
const pagePosDiv = document.getElementById('page-pos');
const pageReportsDiv = document.getElementById('page-reports');

// ** 2.2 POS / Cart **
const productsListDiv = document.getElementById('products-list');
const cartItemsUl = document.getElementById('cart-items');
const cartTotalSpan = document.getElementById('cart-total');
const checkoutButton = document.getElementById('checkout-btn');
const tableNumberInput = document.getElementById('table-number');
const customerNameInput = document.getElementById('customer-name');

// ** 2.3 Reports **
const fetchSalesBtn = document.getElementById('fetch-sales-btn');
const salesTbody = document.getElementById('sales-tbody');
const totalRevenueSpan = document.getElementById('total-revenue');
const totalTransactionsSpan = document.getElementById('total-transactions');


// ===================================================================
// ส่วนที่ 3: ฟังก์ชันการทำงานหลัก (Navigation และ Data Fetching)
// ===================================================================

/**
 * 3.1 ฟังก์ชันจัดการการสลับหน้าจอ (Navigation Logic)
 */
function switchPage(targetPageId, clickedButton) {
    // 1. ซ่อนทุกหน้า
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('active');
    });

    // 2. แสดงเฉพาะหน้าเป้าหมาย
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    }

    // 3. จัดการสถานะปุ่ม (Active Class)
    document.querySelectorAll('.main-nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // 4. การโหลดข้อมูลตามหน้าจอ
    if (targetPageId === 'page-pos') {
        // หากข้อมูลสินค้ายังไม่ถูกโหลด ให้พยายามโหลด
        if (allProducts.length === 0) {
            fetchProducts();
        } else {
            // หากโหลดแล้ว ให้อัพเดทหน้าจอเท่านั้น
            renderProducts(allProducts);
        }
    } else if (targetPageId === 'page-reports') {
        // เมื่อสลับไปหน้า Report ให้ดึงข้อมูลทันที
        fetchAndRenderSales();
    }
}


/**
 * 3.2 ฟังก์ชันดึงข้อมูลสินค้าจาก Apps Script (GET Request)
 */
async function fetchProducts() {
    productsListDiv.innerHTML = '<p>กำลังดึงข้อมูลสินค้า...</p>';
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getProducts`);
        const data = await response.json();

        if (data && Array.isArray(data)) {
            allProducts = data;
            renderProducts(data);
        } else {
            console.error('Data format error:', data);
            productsListDiv.innerHTML = '<p class="error-msg">❌ ไม่สามารถโหลดข้อมูลสินค้าได้ (ตรวจสอบ Apps Script)</p>';
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        productsListDiv.innerHTML = '<p class="error-msg">❌ เกิดข้อผิดพลาดในการเชื่อมต่อ (CORS/URL)</p>';
    }
}


/**
 * 3.3 ฟังก์ชันแสดงสินค้าบนหน้าเว็บ
 */
function renderProducts(products) {
    productsListDiv.innerHTML = '';
    if (products.length === 0) {
        productsListDiv.innerHTML = '<p>ไม่พบรายการสินค้าในฐานข้อมูล</p>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        // ใช้ product['รหัสสินค้า'] เป็น ID ในการ Add to Cart
        productCard.dataset.sku = product['รหัสสินค้า']; 
        productCard.innerHTML = `
            <h3>${product['ชื่อสินค้า']}</h3>
            <p>ราคา: ฿${product['ราคาขาย'].toFixed(2)}</p>
            <p>คงเหลือ: ${product['คงเหลือ']}</p>
        `;
        productCard.addEventListener('click', () => addToCart(product));
        productsListDiv.appendChild(productCard);
    });
}


// ===================================================================
// ส่วนที่ 4: ฟังก์ชันจัดการตะกร้าสินค้า (Cart Management)
// ===================================================================

function addToCart(product) {
    const sku = product['รหัสสินค้า'];
    if (cart[sku]) {
        cart[sku].quantity++;
    } else {
        cart[sku] = { item: product, quantity: 1 };
    }
    updateCartDisplay();
}

function updateCartDisplay() {
    cartItemsUl.innerHTML = '';
    let total = 0;
    let hasItems = false;
    
    for (const sku in cart) {
        hasItems = true;
        const item = cart[sku];
        const subTotal = item.item['ราคาขาย'] * item.quantity;
        total += subTotal;
        
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            ${item.item['ชื่อสินค้า']} x ${item.quantity} 
            (฿${subTotal.toFixed(2)})
        `;
        cartItemsUl.appendChild(listItem);
    }
    
    if (!hasItems) {
        cartItemsUl.innerHTML = '<li>ไม่มีสินค้าในตะกร้า</li>';
    }

    cartTotalSpan.textContent = total.toFixed(2);
    // เปิด/ปิดปุ่มยืนยันการขาย
    checkoutButton.disabled = !hasItems; 
}


// ===================================================================
// ส่วนที่ 5: ฟังก์ชันบันทึกการขาย (Checkout - POST Request)
// ===================================================================

async function handleCheckout() {
    if (Object.keys(cart).length === 0) {
        alert('กรุณาเลือกสินค้าก่อนยืนยันการขาย');
        return;
    }
    
    checkoutButton.disabled = true; // ปิดปุ่มระหว่างรอ
    checkoutButton.textContent = 'กำลังบันทึก...';

    // 1. ดึงข้อมูลจากฟอร์ม
    const tableNumber = tableNumberInput.value.trim();
    const customerName = customerNameInput.value.trim();
    const netTotal = parseFloat(cartTotalSpan.textContent);
    
    // 2. สร้าง Payload ข้อมูลที่จะส่ง
    const payload = {
        tableNumber: tableNumber,
        customerName: customerName,
        netTotal: netTotal,
        discount: 0, 
        memberId: '', 
        cart: cart
    };
    
    const requestBody = {
        action: 'recordSale',
        payload: payload
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            alert(`✅ บันทึกการขายสำเร็จ! ID: ${result.transactionId}`);
            // รีเซ็ต
            cart = {};
            tableNumberInput.value = '';
            customerNameInput.value = '';
            updateCartDisplay();
        } else {
            alert(`❌ เกิดข้อผิดพลาดในการบันทึก: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Error during checkout:', error);
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
        checkoutButton.disabled = false;
        checkoutButton.textContent = 'ยืนยันการขาย';
    }
}


// ===================================================================
// ส่วนที่ 6: ฟังก์ชันรายงานยอดขาย (Sales Reporting)
// ===================================================================

async function fetchAndRenderSales() {
    salesTbody.innerHTML = '<tr><td colspan="6">กำลังโหลดข้อมูล...</td></tr>';
    
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getSales`);
        const salesData = await response.json();
        
        if (Array.isArray(salesData)) {
            renderSalesTable(salesData);
        } else {
            salesTbody.innerHTML = '<tr><td colspan="6">ไม่สามารถโหลดรายงานยอดขายได้</td></tr>';
        }
    } catch (error) {
        salesTbody.innerHTML = '<tr><td colspan="6">เกิดข้อผิดพลาดในการเชื่อมต่อรายงาน</td></tr>';
    }
}

function renderSalesTable(sales) {
    salesTbody.innerHTML = '';
    let totalRevenue = 0;

    sales.reverse(); 
    
    sales.forEach(record => {
        const row = salesTbody.insertRow();
        row.insertCell().textContent = record['ID ธุรกรรม'];
        row.insertCell().textContent = record['วันที่/เวลา'];
        row.insertCell().textContent = record['หมายเลขโต๊ะ'];
        row.insertCell().textContent = record['ชื่อลูกค้า/ผู้สั่ง'] || '-';
        row.insertCell().textContent = record['ยอดรวมสุทธิ'].toFixed(2);
        row.insertCell().textContent = record['รายการสินค้า'];
        
        totalRevenue += record['ยอดรวมสุทธิ'];
    });
    
    totalRevenueSpan.textContent = totalRevenue.toFixed(2);
    totalTransactionsSpan.textContent = sales.length;
}


// ===================================================================
// ส่วนที่ 7: Event Listeners และการเริ่มต้นระบบ (เมื่อโหลดหน้าเว็บ)
// ===================================================================

// ** 7.1 Navigation Listeners **
navPosBtn.addEventListener('click', () => {
    switchPage('page-pos', navPosBtn);
});

navReportsBtn.addEventListener('click', () => {
    switchPage('page-reports', navReportsBtn);
});

// ** 7.2 Checkout/Report Listeners **
checkoutButton.addEventListener('click', handleCheckout);
fetchSalesBtn.addEventListener('click', fetchAndRenderSales);


// ** 7.3 การเริ่มต้นระบบ (เริ่มต้นที่หน้า POS) **
// เรียกฟังก์ชันโหลดสินค้าครั้งแรกเมื่อโค้ดถูกรัน
fetchProducts();