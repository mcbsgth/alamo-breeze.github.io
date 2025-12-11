// *** เปลี่ยน URL นี้ด้วย Deployment URL ของ Google Apps Script ของคุณ ***
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxhl5GswROA0TkGHQekfUvt75kNlWB7F8daCrNOKZbTmiwtNo06Do9ga3xA9kTfrssK/exec"; 

const productsListDiv = document.getElementById('products-list');
const cartItemsUl = document.getElementById('cart-items');
const cartTotalSpan = document.getElementById('cart-total');
const checkoutButton = document.getElementById('checkout-btn');

let allProducts = []; // เก็บข้อมูลสินค้าทั้งหมดที่ดึงมาจาก Google Sheet
let cart = {}; // เก็บสถานะตะกร้าสินค้า เช่น {SKU1: {item: {...}, quantity: 2}, SKU2: {...}}

// ===================================
// 1. ฟังก์ชันดึงข้อมูลสินค้าจาก Apps Script (Backend)
// ===================================

async function fetchProducts() {
    try {
        // ใช้ Fetch API เพื่อส่ง GET request ไปยัง Apps Script
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getProducts`);
        const data = await response.json();

        if (data && Array.isArray(data)) {
            allProducts = data;
            renderProducts(data);
        } else {
            console.error('Data format error:', data);
            productsListDiv.innerHTML = '<p>ไม่สามารถโหลดข้อมูลสินค้าได้</p>';
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        productsListDiv.innerHTML = '<p>เกิดข้อผิดพลาดในการเชื่อมต่อ</p>';
    }
}

// ===================================
// 2. ฟังก์ชันแสดงสินค้าบนหน้าเว็บ
// ===================================

function renderProducts(products) {
    productsListDiv.innerHTML = '';
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <h3>${product['ชื่อสินค้า']}</h3>
            <p>ราคา: ${product['ราคาขาย'].toFixed(2)} บาท</p>
            <p>คงเหลือ: ${product['คงเหลือ']}</p>
        `;
        // เพิ่ม Event Listener เมื่อคลิกที่สินค้า
        productCard.addEventListener('click', () => addToCart(product));
        productsListDiv.appendChild(productCard);
    });
}

// ===================================
// 3. ฟังก์ชันจัดการตะกร้าสินค้า (Add, Update Total)
// ===================================

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
    
    // แสดงรายการสินค้าในตะกร้า
    for (const sku in cart) {
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
    
    cartTotalSpan.textContent = total.toFixed(2);
    // เปิด/ปิดปุ่มยืนยันการขายตามสถานะตะกร้า
    checkoutButton.disabled = total === 0; 
}

// ===================================
// 4. การทำงานเมื่อโหลดหน้าเว็บ
// ===================================
fetchProducts();
// (โค้ดเดิมด้านบน: GAS_WEB_APP_URL, DOM elements, cart object, fetchProducts, renderProducts, updateCartDisplay)

// ===================================
// 5. ฟังก์ชันจัดการการชำระเงินและส่งข้อมูล
// ===================================

async function handleCheckout() {
    if (Object.keys(cart).length === 0) {
        alert('กรุณาเลือกสินค้าก่อนยืนยันการขาย');
        return;
    }
    
    // 1. ดึงข้อมูลจากฟอร์ม
    const tableNumber = document.getElementById('table-number').value.trim();
    const customerName = document.getElementById('customer-name').value.trim();
    const netTotal = parseFloat(cartTotalSpan.textContent);
    
    // 2. สร้าง Payload ข้อมูลที่จะส่ง
    const payload = {
        tableNumber: tableNumber,
        customerName: customerName,
        netTotal: netTotal,
        discount: 0, // ยังไม่มีระบบส่วนลด
        memberId: '', // ยังไม่มีระบบสมาชิก
        cart: cart
    };
    
    const requestBody = {
        action: 'recordSale',
        payload: payload
    };

    try {
        // 3. ส่ง POST request ไปยัง Apps Script
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            // สำคัญ: ต้องระบุ Content-Type เป็น JSON
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        // 4. จัดการผลลัพธ์
        if (result.status === 'success') {
            alert(`✅ บันทึกการขายสำเร็จ! ID ธุรกรรม: ${result.transactionId}`);
            // รีเซ็ตตะกร้าและฟอร์ม
            cart = {};
            document.getElementById('table-number').value = '';
            document.getElementById('customer-name').value = '';
            updateCartDisplay();
            // (ถ้ามีระบบสต็อก จะเรียกฟังก์ชันอัปเดตสต็อกที่นี่)
        } else {
            alert(`❌ เกิดข้อผิดพลาดในการบันทึก: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Error during checkout:', error);
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
}

// ===================================
// 6. เพิ่ม Event Listener ให้ปุ่ม
// ===================================

checkoutButton.addEventListener('click', handleCheckout);

// (โค้ด fetchProducts() และอื่นๆ อยู่ด้านล่าง)
// ... (โค้ดเดิมด้านบน) ...

const fetchSalesBtn = document.getElementById('fetch-sales-btn');
const salesTbody = document.getElementById('sales-tbody');
const totalRevenueSpan = document.getElementById('total-revenue');
const totalTransactionsSpan = document.getElementById('total-transactions');

// ===================================
// 6. ฟังก์ชันดึงและแสดงผลยอดขาย
// ===================================

async function fetchAndRenderSales() {
    salesTbody.innerHTML = '<tr><td colspan="5">กำลังโหลดข้อมูล...</td></tr>';
    
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getSales`);
        const salesData = await response.json();
        
        if (Array.isArray(salesData)) {
            renderSalesTable(salesData);
        } else {
            console.error('Sales data format error:', salesData);
            salesTbody.innerHTML = '<tr><td colspan="5">ไม่สามารถโหลดรายงานยอดขายได้</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching sales data:', error);
        salesTbody.innerHTML = '<tr><td colspan="5">เกิดข้อผิดพลาดในการเชื่อมต่อรายงาน</td></tr>';
    }
}

function renderSalesTable(sales) {
    salesTbody.innerHTML = '';
    let totalRevenue = 0;

    sales.reverse(); // แสดงรายการล่าสุดก่อน
    
    sales.forEach(record => {
        const row = salesTbody.insertRow();
        row.insertCell().textContent = record['ID ธุรกรรม'];
        row.insertCell().textContent = record['วันที่/เวลา'];
        row.insertCell().textContent = record['หมายเลขโต๊ะ'];
        row.insertCell().textContent = record['ยอดรวมสุทธิ'].toFixed(2);
        row.insertCell().textContent = record['รายการสินค้า'];
        
        totalRevenue += record['ยอดรวมสุทธิ'];
    });
    
    // อัปเดตสรุปยอดรวม
    totalRevenueSpan.textContent = totalRevenue.toFixed(2);
    totalTransactionsSpan.textContent = sales.length;
}

// ===================================
// 7. เพิ่ม Event Listener สำหรับปุ่มรายงาน
// ===================================

fetchSalesBtn.addEventListener('click', fetchAndRenderSales);
// ... (โค้ดเดิมด้านบน) ...

// NEW: DOM elements สำหรับ Navigation
const navPosBtn = document.getElementById('nav-pos');
const navReportsBtn = document.getElementById('nav-reports');
const pagePosDiv = document.getElementById('page-pos');
const pageReportsDiv = document.getElementById('page-reports');

// ===================================
// 8. ฟังก์ชันจัดการการสลับหน้าจอ
// ===================================

function switchPage(targetPageId, clickedButton) {
    // 1. ซ่อนทุกหน้า: ต้องแน่ใจว่า class 'page-content' ถูกใช้ใน HTML
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('active');
    });

    // 2. แสดงเฉพาะหน้าเป้าหมาย: ต้องแน่ใจว่า targetPageId ถูกต้อง
    const targetPage = document.getElementById(targetPageId);
    if (targetPage) { // เพิ่มการตรวจสอบ null เพื่อความปลอดภัย
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    }

    // 3. จัดการสถานะปุ่ม: ต้องแน่ใจว่าใช้ class 'main-nav button'
    document.querySelectorAll('.main-nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (clickedButton) { // เพิ่มการตรวจสอบ null
        clickedButton.classList.add('active');
    }

}

// ===================================
// 9. เพิ่ม Event Listeners สำหรับปุ่มนำทาง
// ===================================

navPosBtn.addEventListener('click', () => {
    switchPage('page-pos', navPosBtn);
});

navReportsBtn.addEventListener('click', () => {
    switchPage('page-reports', navReportsBtn);
});

// ** NOTE: คุณต้องย้ายโค้ด fetchAndRenderSales() และ renderSalesTable() 
// จากขั้นตอนที่ 6 เข้ามาในไฟล์ script.js นี้ด้วย **