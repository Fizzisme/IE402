# IE402 Flutter Frontend - Hien trang, kien truc va huong trien khai production

> Tai lieu nay duoc tong hop tu codebase tai `C:\Users\MSi\3DGeographic\IE402`, tap trung vao thu muc `frontend` va cac API/backend hien co ma Flutter frontend se tich hop.
>
> Ngay lap tai lieu: 2026-05-25.

---

## 1. Ket luan nhanh cho nhom frontend

### 1.1. Hien trang that su cua `frontend`

Thu muc `frontend` hien tai **chua co source code Flutter**.

No chi gom duy nhat:

```text
frontend/
└── README.md
```

Noi dung `frontend/README.md`:

```text
Code flutter trong đây
```

Vi vay, tai thoi diem doc codebase:

| Hang muc | Trang thai |
|---|---|
| `pubspec.yaml` | Chua co |
| `lib/main.dart` | Chua co |
| `lib/` | Chua co |
| `android/`, `ios/`, `web/` | Chua co |
| Quan ly state Flutter | Chua co |
| Routing Flutter | Chua co |
| API client Flutter | Chua co |
| Model/data class Flutter | Chua co |
| Man hinh login/map/route/shelter/incident | Chua co |
| Asset, icon, splash, theme | Chua co |
| Test frontend | Chua co |
| Build production Flutter | Chua co |

Noi ngan gon: **phan frontend Flutter moi la placeholder**, chua co logic frontend nao da duoc implement de phan tich truc tiep.

### 1.2. Vay tai lieu nay gom nhung gi?

De nhom co the tiep tuc trien khai, tai lieu nay tap trung vao 4 lop thong tin:

1. Hien trang frontend Flutter trong repo.
2. Kien truc backend/database hien co ma Flutter can bam vao.
3. Ban thiet ke frontend Flutter nen trien khai: thu muc, module, state, routing, model, service, man hinh, flow.
4. Checklist trien khai production cho mot du an Flutter mobile/web.

---

## 2. Tong quan repo IE402

Codebase hien tai co cau truc cap cao:

```text
IE402/
├── BE/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── modules/
│   │       ├── auth/
│   │       ├── user/
│   │       ├── shelter/
│   │       ├── danger-zones/
│   │       ├── incident/
│   │       ├── route/
│   │       └── map/
│   ├── package.json
│   └── .env.example
├── database/
│   ├── schema.sql
│   └── DATABASE_DESIGN.md
├── frontend/
│   └── README.md
├── DIAGRAMS_MERMAID.md
└── REPORT_DIAGRAMS.md
```

### 2.1. Stack hien tai

| Lop | Cong nghe |
|---|---|
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL + PostGIS + pgRouting |
| ORM | TypeORM |
| Auth | JWT + Passport + bcrypt |
| API response | JSON/GeoJSON |
| Frontend | Chua co Flutter source |

### 2.2. San pham dang huong toi

Theo backend, database va cac diagram, IE402 la ung dung **Evacuation Navigation App**:

1. Nguoi dung dang ky/dang nhap.
2. Ung dung lay/cap nhat vi tri hien tai cua nguoi dung.
3. Hien thi ban do gom shelter, danger zone va incident.
4. Tim shelter gan nhat con kha dung.
5. Tinh tuyen di tan an toan toi shelter.
6. Cho phep nguoi dung bao cao incident tai hien truong.
7. Cho phep admin quan ly shelter va danger zone.

---

## 3. Bootstrap/backend contract ma Flutter can biet

### 3.1. Base URL va prefix API

Trong `BE/src/main.ts`:

```ts
app.setGlobalPrefix('api/v1');
await app.listen(process.env.PORT ?? 3000);
```

Neu backend chay local port 3000, base URL cho Flutter se la:

```text
http://localhost:3000/api/v1
```

Luu y khi chay tren thiet bi/emulator:

| Moi truong | Base URL goi tu Flutter |
|---|---|
| Android emulator | `http://10.0.2.2:3000/api/v1` |
| iOS simulator | `http://localhost:3000/api/v1` |
| Thiet bi that cung LAN | `http://<IP-may-chay-backend>:3000/api/v1` |
| Production | `https://api.<domain-cua-nhom>/api/v1` |

### 3.2. CORS

Backend dang bat:

```ts
app.enableCors();
```

Dieu nay giup Flutter web/mobile goi API de hon trong dev. Khi production nen gioi han origin cho web frontend neu co Flutter Web.

### 3.3. ValidationPipe

Backend dung global `ValidationPipe`:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})
```

Y nghia voi Flutter:

1. Field khong co trong DTO co the bi loai bo.
2. Query param dang string co the duoc transform sang number neu DTO dung `@Type(() => Number)`.
3. Flutter nen gui dung field name backend mong doi, tranh dat camelCase tuy tien.

### 3.4. Auth token

Backend dung JWT Bearer token:

```text
Authorization: Bearer <access_token>
```

JWT expiry trong `AuthModule`:

```ts
signOptions: { expiresIn: '7d' }
```

Flutter can luu token bang secure storage, vi token co han 7 ngay va hien chua co refresh token endpoint.

---

## 4. API hien co de Flutter tich hop

### 4.1. Bang tom tat endpoint

| Nhom | Method | Endpoint | Auth | Muc dich |
|---|---:|---|---|---|
| Auth | POST | `/auth/register` | Khong | Dang ky va nhan JWT |
| Auth | POST | `/auth/login` | Khong | Dang nhap va nhan JWT |
| User | GET | `/users/me` | Co | Lay profile hien tai |
| User | PATCH | `/users/me/location` | Co | Cap nhat GPS cua user |
| Shelter | POST | `/shelters` | Co | Tao shelter |
| Shelter | GET | `/shelters` | Khong | Lay tat ca shelter |
| Shelter | GET | `/shelters/nearest` | Khong | Tim shelter gan nhat |
| Shelter | GET | `/shelters/:id` | Khong | Lay chi tiet shelter |
| Shelter | PATCH | `/shelters/:id/status` | Co | Doi trang thai shelter |
| Danger zone | POST | `/danger-zones` | Co | Tao vung nguy hiem |
| Danger zone | GET | `/danger-zones` | Khong | Lay cac vung active |
| Danger zone | GET | `/danger-zones/check` | Khong | Kiem tra diem co nam trong vung nguy hiem |
| Danger zone | DELETE | `/danger-zones/:id` | Co | Soft delete/vu hieu hoa danger zone |
| Incident | POST | `/incidents` | Co | Bao cao su co |
| Incident | GET | `/incidents` | Khong | Lay incident active gan vi tri |
| Incident | PATCH | `/incidents/:id/resolve` | Co | Danh dau incident da xu ly |
| Route | POST | `/route/calculate` | Co | Tinh tuyen di tan an toan |
| Map | GET | `/map/shelters` | Khong | GeoJSON layer shelters |
| Map | GET | `/map/danger-zones` | Khong | GeoJSON layer danger zones |
| Map | GET | `/map/incidents` | Khong | GeoJSON layer incidents |

### 4.2. Quy uoc response

Backend khong co wrapper response hoan toan dong nhat, nhung phan lon endpoint nghiep vu tra ve:

```json
{
  "message": "Some message",
  "data": {}
}
```

Mot so endpoint map tra truc tiep GeoJSON:

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

Flutter API client nen xu ly duoc ca hai kieu:

1. `ApiEnvelope<T>` cho response co `data`.
2. `GeoJsonFeatureCollection` cho response map tra truc tiep.

---

## 5. Auth module - logic backend va yeu cau frontend

### 5.1. Dang ky

Endpoint:

```http
POST /api/v1/auth/register
```

Request body:

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "12345678",
  "phone": "0909000000"
}
```

Validation:

| Field | Bat buoc | Dieu kien |
|---|---|---|
| `name` | Co | String, not empty |
| `email` | Co | Email hop le |
| `password` | Co | String, toi thieu 8 ky tu |
| `phone` | Khong | String |

Logic backend:

1. Kiem tra email da ton tai bang `UserService.findByEmail`.
2. Neu email ton tai: throw `ConflictException('Email already in use')`.
3. Hash password bang `bcrypt.hash(password, 10)`.
4. Tao user role mac dinh `user`.
5. Sign JWT payload `{ sub, email, role }`.
6. Tra ve access token va user rut gon.

Response thanh cong:

```json
{
  "message": "Registration successful",
  "data": {
    "access_token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "role": "user"
    }
  }
}
```

Frontend can implement:

1. Form register gom name, email, password, phone optional.
2. Validate password >= 8 ky tu o client truoc khi goi API.
3. Neu thanh cong, luu token vao secure storage.
4. Dieu huong vao man hinh map/home.
5. Neu conflict, hien thong bao email da duoc su dung.

### 5.2. Dang nhap

Endpoint:

```http
POST /api/v1/auth/login
```

Request body:

```json
{
  "email": "a@example.com",
  "password": "12345678"
}
```

Logic backend:

1. Tim user theo email.
2. Neu khong co user hoac user khong co password hash: unauthorized.
3. So sanh password bang bcrypt.
4. Neu `is_active = false`: unauthorized.
5. Sign JWT va tra ve token.

Frontend can implement:

1. Login form email/password.
2. Loading state khi submit.
3. Error state cho sai thong tin dang nhap.
4. Sau login nen goi `/users/me` de lay profile day du hon, vi response login chi co user rut gon.

### 5.3. Auth session trong Flutter

Nen co `AuthRepository` chiu trach nhiem:

1. `login(email, password)`.
2. `register(...)`.
3. `loadStoredSession()`.
4. `saveSession(accessToken, user)`.
5. `clearSession()`.
6. `getMe()`.

Nen co `AuthController/AuthNotifier` chiu trach nhiem state:

```text
unknown -> unauthenticated -> authenticated
```

Luon attach token trong interceptor:

```text
Authorization: Bearer <token>
```

Khi API tra 401:

1. Clear token.
2. Dua user ve login.
3. Khong retry vo han vi backend chua co refresh token.

---

## 6. User module - profile va cap nhat vi tri

### 6.1. Lay profile

Endpoint:

```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

Response:

```json
{
  "data": {
    "id": "<uuid>",
    "name": "Nguyen Van A",
    "phone": "0909000000",
    "email": "a@example.com",
    "role": "user",
    "fcm_token": null,
    "is_active": true,
    "created_at": "...",
    "updated_at": "...",
    "lng": 106.7,
    "lat": 10.8
  }
}
```

Logic backend:

1. Lay `userId` tu JWT.
2. Query user va convert `last_known_location` thanh `lng`, `lat`.
3. Neu khong thay user: `NotFoundException`.

Frontend can implement:

1. Profile screen.
2. Bootstrap session: co token thi goi `/users/me` de xac thuc token con hop le.
3. Luu role de hien/ an chuc nang admin.

### 6.2. Cap nhat vi tri

Endpoint:

```http
PATCH /api/v1/users/me/location
Authorization: Bearer <token>
```

Request body:

```json
{
  "lat": 10.762622,
  "lng": 106.660172
}
```

Validation:

| Field | Dieu kien |
|---|---|
| `lat` | Number, latitude hop le |
| `lng` | Number, longitude hop le |

Logic backend:

1. Lay user tu JWT.
2. Update `users.last_known_location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)`.
3. Cap nhat `updated_at = NOW()`.

Frontend can implement:

1. Xin quyen location bang `geolocator` + `permission_handler`.
2. Khi user mo map, lay GPS hien tai.
3. Gui vi tri len backend sau khi login.
4. Chi gui theo throttle/debounce, tranh moi giay gui lien tuc.
5. Khi tinh route, dung cung toa do GPS hien tai.

---

## 7. Map module - du lieu GeoJSON cho ban do

### 7.1. Endpoint map

Backend co 3 endpoint GeoJSON:

```http
GET /api/v1/map/shelters
GET /api/v1/map/danger-zones
GET /api/v1/map/incidents
```

Tat ca deu tra ve:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {},
      "properties": {}
    }
  ]
}
```

### 7.2. Layer shelters

Properties tra ve:

| Field | Mo ta |
|---|---|
| `id` | UUID shelter |
| `name` | Ten shelter |
| `description` | Mo ta |
| `address` | Dia chi |
| `capacity` | Suc chua |
| `current_occupancy` | So nguoi hien tai |
| `status` | `available`, `full`, `closed` |
| `type` | Loai shelter |
| `contact_phone` | So dien thoai |
| `has_medical` | Co y te |
| `has_food` | Co thuc pham |
| `has_water` | Co nuoc |
| `image_url` | Anh |

Geometry la Point.

Frontend nen render:

1. Marker mau xanh cho `available`.
2. Marker mau vang/cam cho `full`.
3. Marker mau xam/do cho `closed`.
4. Bottom sheet chi tiet khi tap marker.
5. Nut "Tim duong" goi `/route/calculate` voi `shelter_id`.

### 7.3. Layer danger zones

Properties tra ve:

| Field | Mo ta |
|---|---|
| `id` | UUID danger zone |
| `name` | Ten vung |
| `danger_level` | 1-5 |
| `event_type` | Loai su kien |
| `description` | Mo ta |
| `data_source` | `manual`, `acled`, `ucdp` |
| `valid_from` | Bat dau hieu luc |
| `valid_until` | Het hieu luc, co the null |
| `is_active` | Trang thai |

Geometry la Polygon.

Frontend nen render:

| `danger_level` | Goi y mau |
|---:|---|
| 1 | Vang nhat, opacity thap |
| 2 | Vang |
| 3 | Cam |
| 4 | Do |
| 5 | Do dam/tim dam |

Luu y:

1. Backend chi tra active va con hieu luc.
2. Khi user di chuyen, co the goi `/danger-zones/check?lat=...&lng=...` de canh bao neu dang o trong vung nguy hiem.

### 7.4. Layer incidents

Properties tra ve:

| Field | Mo ta |
|---|---|
| `id` | UUID incident |
| `type` | `blocked_road`, `flood_point`, `fire_point`, `debris`, `other` |
| `severity` | `low`, `medium`, `high` |
| `description` | Mo ta |
| `reported_by` | User id |
| `reported_at` | Thoi diem bao |
| `affected_radius_m` | Ban kinh anh huong |
| `image_url` | URL anh |

Geometry la Point.

Frontend nen render:

1. Marker incident theo icon/type.
2. Mau theo severity.
3. Vong tron radius neu map library ho tro.
4. Bottom sheet chi tiet va nut resolve neu role admin.

---

## 8. Shelter module - logic va UI nen co

### 8.1. Lay tat ca shelter

Endpoint:

```http
GET /api/v1/shelters
```

Tra ve list shelter co `lat`, `lng` da duoc convert tu geometry.

Frontend dung cho:

1. Shelter list screen.
2. Search/filter shelter.
3. Chon shelter lam diem den.

### 8.2. Tim shelter gan nhat

Endpoint:

```http
GET /api/v1/shelters/nearest?lat=10.762622&lng=106.660172&limit=5
```

Logic backend:

1. Chi lay shelter `status = 'available'`.
2. Sap xep theo khoang cach voi `geom <-> point`.
3. Tra `distance_m`.

Frontend can:

1. Gui GPS hien tai.
2. Hien danh sach shelter gan nhat.
3. Hien distance da format: met/km.
4. Neu rong, hien empty state "khong co shelter kha dung gan day".

### 8.3. Lay chi tiet shelter

Endpoint:

```http
GET /api/v1/shelters/:id
```

Dung cho:

1. Shelter detail screen.
2. Bottom sheet sau khi tap marker.
3. Route screen de hien diem den.

### 8.4. Tao shelter

Endpoint:

```http
POST /api/v1/shelters
Authorization: Bearer <token>
```

Request body:

```json
{
  "name": "Ham tru an Quan 1",
  "description": "Diem tru an cong cong",
  "lat": 10.7831,
  "lng": 106.6911,
  "address": "Quan 1, TP.HCM",
  "capacity": 300,
  "type": "bunker",
  "contact_phone": "0909000000",
  "has_medical": true,
  "has_food": true,
  "has_water": true,
  "image_url": "https://..."
}
```

Logic backend:

1. Insert vao bang `shelters`.
2. Geometry tao bang `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`.
3. `current_occupancy = 0`.
4. `status = 'available'`.

Frontend nen dat trong khu vuc admin.

Luu y quan trong: backend hien chi can JWT, **chua enforce role admin**. Flutter co the an UI admin voi user thuong, nhung backend van can bo sung guard role neu muon bao mat that.

### 8.5. Cap nhat status shelter

Endpoint:

```http
PATCH /api/v1/shelters/:id/status
Authorization: Bearer <token>
```

Request:

```json
{
  "status": "available"
}
```

Status hop le:

```text
available | full | closed
```

Frontend:

1. Admin detail screen nen co segmented control/dropdown status.
2. Sau khi update, refresh shelter layer va shelter detail.

---

## 9. Danger Zones module - logic polygon va canh bao

### 9.1. Lay danger zones active

Endpoint:

```http
GET /api/v1/danger-zones
```

Tra ve:

```json
{
  "data": [
    {
      "id": "...",
      "name": "...",
      "danger_level": 4,
      "event_type": "flood",
      "geojson": {
        "type": "Polygon",
        "coordinates": []
      }
    }
  ]
}
```

Khac voi `/map/danger-zones`, endpoint nay boc trong `data` va field geometry ten la `geojson`.

### 9.2. Kiem tra vi tri co nam trong danger zone

Endpoint:

```http
GET /api/v1/danger-zones/check?lat=10.76&lng=106.66
```

Logic backend:

1. Query danger zone active.
2. Chi lay zone con hieu luc: `valid_until IS NULL OR valid_until > NOW()`.
3. Dung `ST_Contains(geom, point)`.
4. Tra:

```json
{
  "data": {
    "inside": true,
    "zones": []
  }
}
```

Frontend:

1. Goi khi app co GPS moi, nhung nen throttle.
2. Neu `inside = true`, hien banner/canh bao.
3. Co the uu tien zone co `danger_level` cao nhat de hien thong diep.

### 9.3. Tao danger zone

Endpoint:

```http
POST /api/v1/danger-zones
Authorization: Bearer <token>
```

Request:

```json
{
  "name": "Vung ngap lut B",
  "coordinates": [
    [106.67, 10.75],
    [106.68, 10.75],
    [106.68, 10.76],
    [106.67, 10.76],
    [106.67, 10.75]
  ],
  "danger_level": 2,
  "event_type": "flood",
  "description": "Khu vuc ngap",
  "data_source": "manual",
  "valid_from": "2026-05-25T00:00:00.000Z",
  "valid_until": null
}
```

Validation theo DTO:

| Field | Dieu kien |
|---|---|
| `coordinates` | `number[][]`, bat buoc |
| `danger_level` | Number 1-5 |
| `event_type` | `armed_conflict`, `flood`, `fire`, `landslide`, `other` |
| `data_source` | `acled`, `ucdp`, `manual` |

Logic backend:

1. Build WKT bang tung point theo thu tu `[lng, lat]`.
2. Insert polygon bang `ST_GeomFromText`.
3. Mac dinh `data_source = manual`.
4. Mac dinh `valid_from = NOW()` neu khong gui.
5. `is_active = true`.

Luu y rat quan trong cho Flutter:

1. Polygon PostGIS thuong can toa do dau va cuoi trung nhau.
2. Code backend hien **chua tu dong dong polygon**.
3. Flutter drawing tool nen dam bao `coordinates.first == coordinates.last`.
4. Thu tu toa do phai la `[lng, lat]`, khong phai `[lat, lng]`.

### 9.4. Vo hieu hoa danger zone

Endpoint:

```http
DELETE /api/v1/danger-zones/:id
Authorization: Bearer <token>
```

Logic backend:

1. Khong xoa vat ly.
2. Update `is_active = FALSE`.
3. Cac endpoint map/list se khong hien zone nay nua.

Frontend:

1. Admin co nut deactivate.
2. Nen hien confirm dialog truoc khi goi API.

---

## 10. Incident module - bao cao su co tu hien truong

### 10.1. Tao incident

Endpoint:

```http
POST /api/v1/incidents
Authorization: Bearer <token>
```

Request:

```json
{
  "lat": 10.762622,
  "lng": 106.660172,
  "type": "blocked_road",
  "description": "Duong bi chan boi vat can",
  "severity": "high",
  "affected_radius_m": 50,
  "image_url": "https://..."
}
```

Validation:

| Field | Dieu kien |
|---|---|
| `lat` | Latitude |
| `lng` | Longitude |
| `type` | `blocked_road`, `flood_point`, `fire_point`, `debris`, `other` |
| `severity` | `low`, `medium`, `high` |
| `affected_radius_m` | Number >= 0 |

Logic backend:

1. Insert incident point vao database.
2. Gan `reported_by` = user id tu JWT.
3. Mac dinh `severity = medium`.
4. Mac dinh `affected_radius_m = 50`.
5. `is_active = TRUE`.

Frontend:

1. Man hinh report incident nen lay GPS hien tai.
2. Cho phep user chon loai incident bang segmented control/menu.
3. Cho phep user nhap mo ta.
4. Neu co chup anh, backend hien chi nhan `image_url`, chua co upload endpoint. Can upload anh len storage rieng truoc, sau do gui URL.

### 10.2. Lay incident gan vi tri

Endpoint:

```http
GET /api/v1/incidents?lat=10.76&lng=106.66&radius=500
```

Logic backend:

1. Lay incident active.
2. Loc trong ban kinh `radius` met.
3. Sap xep theo `distance_m`.

Frontend:

1. Dung cho "su co gan toi".
2. Dung de hien list canh bao gan vi tri user.
3. Neu chi can render tat ca incident active tren map, dung `/map/incidents`.

### 10.3. Resolve incident

Endpoint:

```http
PATCH /api/v1/incidents/:id/resolve
Authorization: Bearer <token>
```

Logic backend:

1. Update `is_active = FALSE`.
2. Set `resolved_at = NOW()`.

Frontend:

1. Chi nen hien voi role admin.
2. Sau khi resolve, refresh incident layer.

---

## 11. Route module - tinh tuyen di tan an toan

### 11.1. Endpoint tinh route

Endpoint:

```http
POST /api/v1/route/calculate
Authorization: Bearer <token>
```

Request khi user chua chon shelter:

```json
{
  "start_lat": 10.762622,
  "start_lng": 106.660172
}
```

Request khi user chon shelter cu the:

```json
{
  "start_lat": 10.762622,
  "start_lng": 106.660172,
  "shelter_id": "<uuid>"
}
```

### 11.2. Logic backend tung buoc

Trong `RouteService.calculateRoute`:

1. Lay `start_lat`, `start_lng`.
2. Neu request co `shelter_id`:
   - Query shelter theo id.
   - Neu khong thay: throw `NotFoundException`.
3. Neu khong co `shelter_id`:
   - Tim shelter gan nhat co `status = 'available'`.
   - Neu khong co shelter kha dung: throw `BadRequestException`.
4. Tim road node gan nhat voi diem xuat phat.
5. Tim road node gan nhat voi shelter.
6. Neu khong tim duoc node: throw `BadRequestException`.
7. Chay `pgr_dijkstra`.
8. Cost cua moi canh duong duoc tang theo danger zone giao cat:

```text
cost = length_m * (1 + max_danger_level * 2.0)
```

Vi du:

| Danger level | He so cost |
|---:|---:|
| 0 | 1.0 |
| 1 | 3.0 |
| 2 | 5.0 |
| 3 | 7.0 |
| 4 | 9.0 |
| 5 | 11.0 |

9. Bo qua road co `is_blocked = TRUE`.
10. Build route thanh GeoJSON FeatureCollection.
11. Tinh:
    - `total_distance_m`
    - `estimated_time_min`
    - `total_risk_score`
12. Thu insert vao `evacuation_routes`, nhung neu save loi thi catch va van tra route cho client.

### 11.3. Response route

```json
{
  "message": "Route calculated",
  "data": {
    "shelter": {
      "id": "<uuid>",
      "name": "Ham tru an Quan 1",
      "address": "...",
      "lat": 10.7831,
      "lng": 106.6911,
      "status": "available",
      "type": "bunker",
      "capacity": 300,
      "current_occupancy": 20
    },
    "total_distance_m": 2300,
    "estimated_time_min": 27.6,
    "total_risk_score": 4200.5,
    "route_geojson": {
      "type": "FeatureCollection",
      "features": []
    }
  }
}
```

### 11.4. Frontend UI cho route

Nen co:

1. Nut "Tim duong an toan" tren map.
2. Neu user tap shelter marker, nut "Di den shelter nay".
3. Loading overlay trong khi tinh route.
4. Ve polyline route tren map.
5. Hien panel thong tin:
   - Shelter dich.
   - Khoang cach.
   - Thoi gian uoc tinh.
   - Diem rui ro.
6. Neu loi:
   - Khong co shelter kha dung.
   - Khong co road network node.
   - Khong tim thay route.
   - Chua dang nhap.

### 11.5. Dieu kien database de route chay duoc

Route module phu thuoc nang vao database:

1. Bang `road_network` phai co data.
2. `source` va `target` phai duoc tao bang pgRouting topology.
3. `length_m` phai co gia tri.
4. `is_blocked` phai duoc set dung.
5. Bang `danger_zones` co polygon hop le neu muon tinh risk.

Neu Flutter goi `/route/calculate` ma database chua co road network/topology, API se loi.

---

## 12. Database/domain model can phan anh trong Flutter

### 12.1. User

Flutter model nen co:

```dart
class AppUser {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String role;
  final String? fcmToken;
  final bool isActive;
  final double? lat;
  final double? lng;
}
```

Role hien co:

```text
user | admin
```

Luu y: backend chua co role guard, nhung frontend van nen dung role de dieu khien UI.

### 12.2. Shelter

```dart
class Shelter {
  final String id;
  final String name;
  final String? description;
  final String? address;
  final int capacity;
  final int currentOccupancy;
  final ShelterStatus status;
  final String? type;
  final String? contactPhone;
  final bool hasMedical;
  final bool hasFood;
  final bool hasWater;
  final String? imageUrl;
  final double lat;
  final double lng;
  final double? distanceM;
}
```

Enum:

```dart
enum ShelterStatus { available, full, closed }
```

### 12.3. DangerZone

```dart
class DangerZone {
  final String id;
  final String? name;
  final int dangerLevel;
  final String eventType;
  final String? description;
  final String dataSource;
  final DateTime? validFrom;
  final DateTime? validUntil;
  final bool isActive;
  final Map<String, dynamic> geojson;
}
```

### 12.4. Incident

```dart
class Incident {
  final String id;
  final double lat;
  final double lng;
  final String type;
  final String? description;
  final String severity;
  final String? reportedBy;
  final DateTime? reportedAt;
  final bool isActive;
  final DateTime? resolvedAt;
  final double affectedRadiusM;
  final String? imageUrl;
  final double? distanceM;
}
```

### 12.5. RouteResult

```dart
class RouteResult {
  final Shelter shelter;
  final int totalDistanceM;
  final double estimatedTimeMin;
  final double totalRiskScore;
  final Map<String, dynamic> routeGeojson;
}
```

### 12.6. GeoJSON

Nen co model toi thieu:

```dart
class GeoJsonFeatureCollection {
  final String type;
  final List<GeoJsonFeature> features;
}

class GeoJsonFeature {
  final String type;
  final Map<String, dynamic> geometry;
  final Map<String, dynamic> properties;
}
```

Neu dung map library co converter rieng, co the giu `Map<String, dynamic>` va convert sang marker/polygon/polyline o tang adapter.

---

## 13. Kien truc Flutter de xuat

Viec frontend chua co source la co hoi de scaffold sach tu dau. Kien truc nen theo feature-based + core/shared.

### 13.1. Cau truc thu muc de xuat

```text
frontend/
├── pubspec.yaml
├── analysis_options.yaml
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── app.dart
│   │   ├── router.dart
│   │   └── theme/
│   │       ├── app_colors.dart
│   │       ├── app_theme.dart
│   │       └── app_typography.dart
│   ├── core/
│   │   ├── config/
│   │   │   ├── app_config.dart
│   │   │   └── environment.dart
│   │   ├── network/
│   │   │   ├── api_client.dart
│   │   │   ├── api_exception.dart
│   │   │   ├── auth_interceptor.dart
│   │   │   └── endpoints.dart
│   │   ├── storage/
│   │   │   ├── secure_token_storage.dart
│   │   │   └── session_storage.dart
│   │   ├── location/
│   │   │   ├── location_service.dart
│   │   │   └── location_permission_service.dart
│   │   ├── geojson/
│   │   │   ├── geojson_models.dart
│   │   │   └── geojson_map_adapter.dart
│   │   └── utils/
│   │       ├── result.dart
│   │       └── formatters.dart
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── auth_api.dart
│   │   │   │   ├── auth_repository.dart
│   │   │   │   └── models/
│   │   │   ├── presentation/
│   │   │   │   ├── login_screen.dart
│   │   │   │   ├── register_screen.dart
│   │   │   │   └── auth_controller.dart
│   │   │   └── domain/
│   │   ├── map/
│   │   │   ├── data/
│   │   │   │   ├── map_api.dart
│   │   │   │   └── map_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── map_screen.dart
│   │   │   │   ├── map_controller.dart
│   │   │   │   ├── layer_toggle_bar.dart
│   │   │   │   └── map_bottom_sheets.dart
│   │   │   └── domain/
│   │   ├── shelter/
│   │   ├── danger_zone/
│   │   ├── incident/
│   │   ├── route/
│   │   ├── profile/
│   │   └── admin/
│   └── shared/
│       ├── widgets/
│       ├── dialogs/
│       └── constants/
├── test/
└── integration_test/
```

### 13.2. Nguyen tac chia lop

| Lop | Trach nhiem |
|---|---|
| `app/` | Khoi tao app, router, theme |
| `core/config` | Base URL, flavor, environment |
| `core/network` | Dio client, interceptor, exception mapping |
| `core/storage` | Luu token/session bang secure storage |
| `core/location` | Xin quyen va lay GPS |
| `core/geojson` | Parse/convert GeoJSON sang marker/polygon/polyline |
| `features/*/data` | API va repository |
| `features/*/domain` | Entity/use case neu can tach clean architecture |
| `features/*/presentation` | Screen, controller, state |
| `shared` | Widget dung chung |

### 13.3. Goi package nen dung

Nen can nhac:

| Nhu cau | Package goi y |
|---|---|
| State management | `flutter_riverpod` |
| Routing | `go_router` |
| HTTP client | `dio` |
| Secure token | `flutter_secure_storage` |
| JSON model | `freezed`, `json_serializable`, `build_runner` |
| Location | `geolocator`, `permission_handler` |
| Map | `flutter_map` + `latlong2` hoac `maplibre_gl` |
| Crash/error | `sentry_flutter` hoac Firebase Crashlytics |
| Logging dev | `talker_flutter` hoac custom logger |
| Env/flavor | `--dart-define`, hoac `flutter_dotenv` cho dev |

Lua chon map:

1. `flutter_map` phu hop neu dung OpenStreetMap/raster tiles, de ve marker, polygon, polyline.
2. `maplibre_gl` phu hop neu sau nay dung vector tiles/style rieng.
3. `google_maps_flutter` de dung Google Maps, nhung can API key va policy billing.

Voi backend dang tra GeoJSON, `flutter_map` la lua chon don gian nhat de bat dau.

---

## 14. Routing/navigation de xuat trong Flutter

Dung `go_router` voi auth redirect.

### 14.1. Route tree

```text
/splash
/login
/register
/map
/shelters
/shelters/:id
/incidents/new
/profile
/admin
/admin/shelters/new
/admin/danger-zones/new
```

### 14.2. Guard logic

1. App start -> doc token tu secure storage.
2. Neu co token -> goi `/users/me`.
3. Neu thanh cong -> vao `/map`.
4. Neu that bai -> clear token -> `/login`.
5. Cac route can auth:
   - `/profile`
   - `/incidents/new`
   - route calculate action
   - admin screens
6. Admin screens chi hien neu `user.role == 'admin'`.

---

## 15. State management de xuat

### 15.1. Cac state chinh

| Controller | State nen quan ly |
|---|---|
| `AuthController` | session, token, user, login/register loading/error |
| `MapController` | selected layers, GeoJSON layers, selected feature, current location |
| `LocationController` | permission, current GPS, stream/tracking |
| `ShelterController` | shelter list, nearest shelters, selected shelter |
| `RouteController` | calculating, route result, route error, selected destination |
| `IncidentController` | nearby incidents, report form state, submit loading/error |
| `DangerZoneController` | active zones, inside danger status |
| `ProfileController` | profile loading/error |
| `AdminController` | create/update/deactivate actions |

### 15.2. Trang thai bat buoc tren UI

Moi man hinh goi API nen co:

1. Loading.
2. Loaded.
3. Empty.
4. Error.
5. Refreshing.

Man hinh map nen dac biet xu ly:

1. Dang xin quyen location.
2. Bi tu choi quyen location.
3. Khong bat duoc GPS.
4. API map layer loi mot phan.
5. Route calculate dang chay.
6. Route calculate loi.

---

## 16. Cac man hinh nen trien khai

### 16.1. Splash/Bootstrap screen

Muc dich:

1. Khoi tao config.
2. Doc token.
3. Goi `/users/me` neu co token.
4. Dieu huong login hoac map.

### 16.2. Login screen

Thanh phan:

1. Email input.
2. Password input.
3. Login button.
4. Link sang register.
5. Error banner/snackbar.

API:

```text
POST /auth/login
```

### 16.3. Register screen

Thanh phan:

1. Name input.
2. Email input.
3. Password input.
4. Phone optional.
5. Register button.

API:

```text
POST /auth/register
```

### 16.4. Map screen

Day la man hinh trung tam cua app.

Thanh phan:

1. Ban do nen.
2. Nut locate me.
3. Toggle layer:
   - shelters
   - danger zones
   - incidents
   - route
4. Marker shelters.
5. Polygon danger zones.
6. Marker/circle incidents.
7. Polyline route.
8. Bottom sheet feature detail.
9. Nut "Tim shelter gan nhat".
10. Nut "Tinh route an toan".
11. Banner danger alert neu user dang nam trong danger zone.

API:

```text
GET /map/shelters
GET /map/danger-zones
GET /map/incidents
PATCH /users/me/location
GET /danger-zones/check
POST /route/calculate
```

### 16.5. Shelter list/detail

Shelter list:

1. List tat ca shelter.
2. Filter theo status/type.
3. Sort theo distance neu co GPS.

Shelter detail:

1. Ten, dia chi, suc chua.
2. Status.
3. Tien ich: medical/food/water.
4. Contact phone.
5. Nut "Tim duong".

API:

```text
GET /shelters
GET /shelters/:id
GET /shelters/nearest
```

### 16.6. Incident report screen

Thanh phan:

1. Current location.
2. Type selector.
3. Severity selector.
4. Radius input/slider.
5. Description.
6. Image picker optional.
7. Submit.

API:

```text
POST /incidents
```

Luu y: backend chua co upload file, chi nhan `image_url`.

### 16.7. Profile screen

Thanh phan:

1. Name/email/phone.
2. Role.
3. Last known location.
4. Logout.

API:

```text
GET /users/me
```

### 16.8. Admin screens

Neu `role == admin`, co the hien:

1. Tao shelter.
2. Doi status shelter.
3. Tao danger zone bang drawing polygon.
4. Deactivate danger zone.
5. Resolve incident.

API:

```text
POST /shelters
PATCH /shelters/:id/status
POST /danger-zones
DELETE /danger-zones/:id
PATCH /incidents/:id/resolve
```

Luu y bao mat: backend hien chua co role guard, nen day chi la UI guard. Muon production that su phai them backend role guard.

---

## 17. Luong nghiep vu frontend nen implement

### 17.1. Luong dang nhap

```text
User nhap email/password
-> Flutter validate form
-> POST /auth/login
-> Nhan access_token
-> Luu secure storage
-> GET /users/me
-> Luu user profile vao state
-> Dieu huong /map
```

### 17.2. Luong mo ban do

```text
Map screen init
-> Xin quyen location
-> Lay GPS hien tai
-> PATCH /users/me/location neu da login
-> Goi song song 3 map layers
   - /map/shelters
   - /map/danger-zones
   - /map/incidents
-> Render layers
-> Goi /danger-zones/check theo GPS
-> Neu inside danger zone thi hien alert
```

### 17.3. Luong tim shelter gan nhat

```text
User bam "Shelter gan nhat"
-> Lay GPS hien tai
-> GET /shelters/nearest?lat=&lng=&limit=5
-> Hien bottom sheet danh sach
-> User chon shelter
-> Hien detail/marker
-> Co the bam "Tim duong"
```

### 17.4. Luong tinh route an toan

```text
User bam "Tim duong"
-> Kiem tra da dang nhap
-> Lay GPS hien tai
-> Neu co shelter duoc chon, gui shelter_id
-> POST /route/calculate
-> Nhan route_geojson
-> Convert GeoJSON LineString thanh polyline
-> Ve route tren ban do
-> Hien distance/time/risk/shelter
```

### 17.5. Luong bao cao incident

```text
User bam report incident
-> Kiem tra da dang nhap
-> Lay GPS
-> User nhap type/severity/description/radius
-> Neu co anh, upload anh ra storage rieng de lay image_url
-> POST /incidents
-> Refresh /map/incidents
-> Hien marker moi
```

### 17.6. Luong tao danger zone admin

```text
Admin vao danger zone editor
-> Ve polygon tren map
-> App lay danh sach point
-> Convert moi point thanh [lng, lat]
-> Dam bao dong polygon: point cuoi = point dau
-> POST /danger-zones
-> Refresh danger zone layer
```

---

## 18. Nhung diem da implement o backend nhung frontend can chu y

### 18.1. Da co

| Chuc nang backend | Trang thai |
|---|---|
| Register/Login JWT | Da co |
| Hash password bcrypt | Da co |
| Get profile | Da co |
| Update location | Da co |
| CRUD mot phan cho shelter | Da co |
| Query nearest shelter | Da co |
| CRUD mot phan cho danger zone | Da co |
| Check location inside danger zone | Da co |
| Report incident | Da co |
| Query nearby incident | Da co |
| Resolve incident | Da co |
| Map GeoJSON layers | Da co |
| Calculate safe route bang pgRouting | Da co |
| Save route vao `evacuation_routes` | Co thu save, loi thi bo qua |

### 18.2. Chua co hoac chua hoan thien

| Hang muc | Anh huong voi Flutter |
|---|---|
| Frontend Flutter source | Can scaffold tu dau |
| Refresh token/logout server-side | Flutter chi clear local token khi logout |
| Role guard backend | UI admin khong du de bao mat production |
| Upload image | Incident chi nhan `image_url`, can storage rieng |
| Notifications API | DB co bang notifications nhung chua co module API |
| Shelter check-in API | DB co `shelter_checkins`, backend chua co endpoint |
| Emergency events API | DB co bang, backend chua co module |
| Route history API | DB luu `evacuation_routes`, chua co endpoint doc lich su |
| Pagination/filter | Nhieu endpoint tra all, co the nang khi data lon |
| Swagger/OpenAPI | Chua co, frontend phai doc code/DTO |
| Role enum chuan | Backend dung string, frontend nen map defensive |
| Error response chuan | Chua co wrapper loi dong nhat |
| Polygon validation | Backend chua check polygon dong/hop le |
| Road network import script | Database doc co huong dan, repo chua thay script import |

---

## 19. Checklist scaffold Flutter tu con so 0

### 19.1. Tao project

Chay trong `IE402/frontend` hoac tao moi roi move:

```bash
flutter create .
```

Neu muon package name production:

```bash
flutter create --org com.ie402 --project-name ie402_evacuation_app .
```

### 19.2. Cau hinh package can thiet

Trong `pubspec.yaml`, nhom nen them:

```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.0.0
  flutter_riverpod: ^2.0.0
  go_router: ^14.0.0
  flutter_secure_storage: ^9.0.0
  geolocator: ^12.0.0
  permission_handler: ^11.0.0
  flutter_map: ^7.0.0
  latlong2: ^0.9.0
  freezed_annotation: ^2.0.0
  json_annotation: ^4.0.0

dev_dependencies:
  build_runner: ^2.0.0
  freezed: ^2.0.0
  json_serializable: ^6.0.0
  flutter_lints: ^4.0.0
```

Version package nen cap nhat theo `flutter pub add` tai thoi diem cai dat.

### 19.3. Config base URL bang dart define

Vi du:

```bash
flutter run --dart-define=BASE_URL=http://10.0.2.2:3000/api/v1
```

Trong code:

```dart
class AppConfig {
  static const baseUrl = String.fromEnvironment(
    'BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );
}
```

Production:

```bash
flutter build appbundle --release \
  --dart-define=BASE_URL=https://api.example.com/api/v1
```

Luu y: `dart-define` khong phai noi luu secret. Khong dua API secret/JWT secret vao Flutter app.

### 19.4. Config permission

Android:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

iOS `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Ung dung can vi tri de tim shelter va tinh tuyen di tan an toan.</string>
```

Neu dung camera/image picker de report incident, them permission camera/photo.

### 19.5. API client

Nen co:

1. `Dio` singleton/provider.
2. Base URL tu `AppConfig`.
3. Auth interceptor doc token tu secure storage.
4. Error mapper:
   - 400 validation
   - 401 unauthenticated
   - 403 forbidden neu sau nay co role guard
   - 404 not found
   - 409 conflict
   - 500 server error
5. Timeout:
   - connect timeout
   - receive timeout
6. Logging chi bat trong dev.

---

## 20. Huong dan production cho Flutter

### 20.1. Yeu cau production truoc khi build app

Backend:

1. Co domain HTTPS that, vi mobile production khong nen goi HTTP.
2. `JWT_SECRET` phai cau hinh manh, khong dung default `evacuation_jwt_secret_2024`.
3. PostgreSQL/PostGIS/pgRouting da setup.
4. `road_network` da import va tao topology.
5. Seed shelter/danger zone can thiet.
6. CORS cau hinh cho Flutter Web neu deploy web.
7. Role guard nen duoc bo sung cho admin API.
8. Logging/monitoring backend san sang.

Flutter:

1. App name/icon/splash da cau hinh.
2. Bundle id/application id da chot.
3. Permission location co ly do ro rang.
4. Base URL production dung HTTPS.
5. Token luu secure storage.
6. Error UI than thien khi mat mang/location denied.
7. Da chay `flutter analyze`.
8. Da chay `flutter test`.
9. Da test tren thiet bi that Android/iOS.

### 20.2. Android production

Tao keystore:

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Tao `android/key.properties`:

```properties
storePassword=<password>
keyPassword=<password>
keyAlias=upload
storeFile=../upload-keystore.jks
```

Trong Gradle can cau hinh signing config release theo Flutter docs.

Build AAB:

```bash
flutter build appbundle --release \
  --dart-define=BASE_URL=https://api.example.com/api/v1
```

File output thuong nam o:

```text
build/app/outputs/bundle/release/app-release.aab
```

Checklist Play Console:

1. Upload AAB.
2. Khai bao data safety.
3. Giai thich quyen location.
4. Test internal testing truoc.
5. Theo doi crash sau release.

### 20.3. iOS production

Can:

1. Apple Developer account.
2. Bundle identifier.
3. Signing certificate/profile.
4. Cau hinh `Info.plist` permissions.
5. App icon/splash.

Build IPA:

```bash
flutter build ipa --release \
  --dart-define=BASE_URL=https://api.example.com/api/v1
```

Upload bang Xcode Organizer hoac Transporter.

Checklist App Store:

1. Mo ta ly do location.
2. Khai bao privacy nutrition labels.
3. TestFlight truoc khi public.
4. Kiem tra map tile license/API key neu co.

### 20.4. Flutter Web production neu can

Build:

```bash
flutter build web --release \
  --dart-define=BASE_URL=https://api.example.com/api/v1
```

Deploy `build/web` len:

1. Nginx.
2. Firebase Hosting.
3. Netlify/Vercel.
4. S3 + CloudFront.

Can chu y:

1. Backend CORS origin phai cho phep domain web.
2. Route fallback cho SPA phai tro ve `index.html`.
3. HTTPS bat buoc.
4. Secure storage tren web khac mobile; token tren web rui ro hon.

### 20.5. CI/CD de xuat

Pipeline toi thieu:

```text
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
flutter build apk/appbundle/web --release --dart-define=BASE_URL=...
```

Nen tach:

1. Dev build.
2. Staging build.
3. Production build.

Nen version theo:

```yaml
version: 1.0.0+1
```

Moi lan release tang build number.

---

## 21. Bao mat va do tin cay frontend

### 21.1. Token

Nen:

1. Luu access token bang `flutter_secure_storage`.
2. Khong log token.
3. Clear token khi 401.
4. Khong dua JWT secret vao app.

Hien backend chua co refresh token, nen UX khi token het han:

```text
API 401 -> clear session -> hien login -> user dang nhap lai
```

### 21.2. Location

Nen:

1. Chi xin location khi user vao map/route.
2. Giai thich ly do xin permission.
3. Xu ly denied/permanently denied.
4. Khong stream GPS lien tuc neu khong can.
5. Debounce viec cap nhat `/users/me/location`.

### 21.3. Map data

Neu data lon:

1. Khong nen load all features moi lan.
2. Can bbox endpoint sau nay: `?bbox=minLng,minLat,maxLng,maxLat`.
3. Parse GeoJSON lon co the dua sang isolate.
4. Cache layer trong memory va refresh co chu y.

### 21.4. Error handling

Moi API call nen map loi thanh thong diep nguoi dung hieu:

| Loi | UI nen hien |
|---|---|
| 400 | Du lieu nhap chua hop le |
| 401 | Phien dang nhap het han |
| 404 | Khong tim thay du lieu |
| 409 | Email da ton tai |
| 500 | May chu dang gap su co |
| Network | Khong co ket noi mang |

---

## 22. Testing frontend nen co

### 22.1. Unit test

Test:

1. Parse auth response.
2. Parse shelter response.
3. Parse route response.
4. GeoJSON adapter.
5. Formatter distance/time.
6. API exception mapper.

### 22.2. Widget test

Test:

1. Login form validation.
2. Register form validation.
3. Map layer toggle.
4. Incident form.
5. Shelter detail.

### 22.3. Integration test

Test flow:

```text
Open app -> login -> load map -> find nearest shelter -> calculate route
```

Voi backend dev/staging, nen seed database co shelter + road_network de route test chay on dinh.

---

## 23. Lo trinh trien khai de xuat cho nhom

### Phase 1 - Scaffold va core

1. Tao Flutter project trong `frontend`.
2. Them package core.
3. Setup theme/router.
4. Setup Dio + secure storage.
5. Setup environment `BASE_URL`.

Ket qua: app chay duoc man hinh splash/login placeholder.

### Phase 2 - Auth

1. Implement login.
2. Implement register.
3. Luu token.
4. Bootstrap `/users/me`.
5. Logout.

Ket qua: vao app bang account that.

### Phase 3 - Map layers

1. Chon map library.
2. Render base map.
3. Goi `/map/shelters`, `/map/danger-zones`, `/map/incidents`.
4. Convert GeoJSON sang marker/polygon.
5. Layer toggles.

Ket qua: user thay du lieu tren ban do.

### Phase 4 - Location va shelter

1. Xin quyen GPS.
2. Cap nhat `/users/me/location`.
3. Shelter list/detail.
4. Nearest shelter.

Ket qua: user tim duoc shelter gan minh.

### Phase 5 - Route

1. Implement `RouteRepository`.
2. Goi `/route/calculate`.
3. Ve route polyline.
4. Hien metrics distance/time/risk.
5. Xu ly loi route.

Ket qua: use case trung tam cua do an hoat dong.

### Phase 6 - Incident

1. Report incident form.
2. Submit incident.
3. Refresh incident layer.
4. Nearby incident list.

Ket qua: user bao cao duoc su co.

### Phase 7 - Admin va production hardening

1. Admin create shelter.
2. Admin update shelter status.
3. Admin create/deactivate danger zone.
4. Admin resolve incident.
5. Add Crashlytics/Sentry.
6. Build release Android/iOS/Web.

Ket qua: app san sang demo production/staging.

---

## 24. Viec backend nen lam truoc khi frontend production

De Flutter production khong bi chan, backend nen bo sung:

1. Role guard cho admin endpoint.
2. Swagger/OpenAPI de frontend generate client hoac tham chieu schema.
3. Refresh token neu muon UX dang nhap lau dai.
4. Endpoint upload anh incident.
5. Endpoint route history neu muon hien lich su.
6. Endpoint shelter check-in/check-out neu dung occupancy thuc te.
7. Endpoint notification neu dung FCM.
8. Pagination/bbox cho map layer khi du lieu lon.
9. Validation polygon chi tiet.
10. Chuẩn hoa error response.
11. Migration thay vi chi co `schema.sql`.
12. Script import OSM/road network va tao pgRouting topology.

---

## 25. Ghi chu dong bo voi bao cao hien co

Trong `DIAGRAMS_MERMAID.md`, component diagram dang ghi frontend la `React Native App`. Theo prompt hien tai cua nhom, frontend can la **Flutter**.

Khi viet bao cao/thuyet trinh, nen doi:

```text
React Native App
```

thanh:

```text
Flutter Mobile App
```

Neu khong, se co su lech giua tai lieu va huong trien khai thuc te.

---

## 26. Tom tat cuoi

Phan Flutter frontend trong repo IE402 hien **chua duoc implement**: khong co project Flutter, khong co `pubspec.yaml`, khong co `lib/`, khong co man hinh hay logic frontend nao.

Tuy nhien backend va database da co du nen frontend co the bat dau trien khai theo cac module sau:

1. Auth/session.
2. Map layers GeoJSON.
3. Location/profile.
4. Shelter search/detail.
5. Safe route calculation.
6. Incident reporting.
7. Admin management.

Huong di hop ly nhat la scaffold Flutter sach theo feature-based architecture, dung `Dio + Riverpod + GoRouter + SecureStorage + Geolocator + FlutterMap`, sau do tich hop lan luot cac API NestJS da co. Phan production can uu tien HTTPS backend, role guard, secure token storage, location permission ro rang, build Android/iOS bang flavor va `--dart-define=BASE_URL`.
