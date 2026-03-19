from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import random
import asyncio
import base64
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'truco_secret_key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 1440))

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main FastAPI app
app = FastAPI(title="Truco Argentino API")

# Create Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    cashbank: float
    is_admin: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class DepositCreate(BaseModel):
    amount: float

class DepositUpdate(BaseModel):
    status: str  # approved, rejected

class TransferDataUpdate(BaseModel):
    titular: str
    banco: str
    alias: str
    cbu_cvu: str
    tipo_cuenta: str

class TableCreate(BaseModel):
    modality: str  # 1v1, 2v2, 3v3
    entry_cost: float
    max_players: int
    with_flor: bool
    points_to_win: int  # 15 or 30
    is_private: bool = False

class PrivateTableCreate(BaseModel):
    modality: str
    entry_cost: float
    with_flor: bool
    points_to_win: int

class JoinTableRequest(BaseModel):
    code: Optional[str] = None

class ChatMessage(BaseModel):
    content: str
    recipient_id: Optional[str] = None  # For private messages
    table_id: Optional[str] = None  # For table chat
    is_team_chat: bool = False  # For team-only chat in 2v2, 3v3

class AdminSettings(BaseModel):
    private_table_cost: float
    platform_commission: float  # percentage (e.g., 30 for 30%)

# Withdrawal Models
class WithdrawalCreate(BaseModel):
    amount: float
    alias: str
    titular_name: str

class WithdrawalUpdate(BaseModel):
    status: str  # approved, rejected

# Tournament Models
class TournamentCreate(BaseModel):
    name: str
    modality: str  # 1v1, 2v2, 3v3
    num_tables: int  # Number of tables (e.g., 12)
    entry_cost: float
    with_flor: bool
    points_to_win: int  # 15 or 30
    first_place_percentage: float  # e.g., 50
    second_place_percentage: float  # e.g., 20

class TournamentJoinRequest(BaseModel):
    tournament_id: str

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def generate_table_code():
    return ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=6))

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "cashbank": 0.0,
        "is_admin": False,
        "is_suspended": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"user_id": user_id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            email=user_data.email,
            cashbank=0.0,
            is_admin=False,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("is_suspended", False):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    token = create_access_token({"user_id": user["id"]})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            cashbank=user["cashbank"],
            is_admin=user.get("is_admin", False),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        cashbank=user["cashbank"],
        is_admin=user.get("is_admin", False),
        created_at=user["created_at"]
    )

# ============== CASHBANK/DEPOSIT ROUTES ==============

@api_router.get("/cashbank/transfer-data")
async def get_transfer_data():
    data = await db.settings.find_one({"type": "transfer_data"}, {"_id": 0})
    if not data:
        return {
            "titular": "Truco Argentino S.A.",
            "banco": "Banco Nación",
            "alias": "TRUCO.ARGENTINO.APP",
            "cbu_cvu": "0000000000000000000000",
            "tipo_cuenta": "Cuenta Corriente"
        }
    return data

@api_router.post("/cashbank/deposit")
async def create_deposit(deposit: DepositCreate, user: dict = Depends(get_current_user)):
    if deposit.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    deposit_id = str(uuid.uuid4())
    deposit_doc = {
        "id": deposit_id,
        "user_id": user["id"],
        "username": user["username"],
        "amount": deposit.amount,
        "status": "pending",
        "receipt_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    await db.deposits.insert_one(deposit_doc)
    return {"id": deposit_id, "status": "pending", "message": "Deposit request created"}

@api_router.post("/cashbank/deposit/{deposit_id}/receipt")
async def upload_receipt(deposit_id: str, receipt: UploadFile = File(...), user: dict = Depends(get_current_user)):
    deposit = await db.deposits.find_one({"id": deposit_id, "user_id": user["id"]}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    content = await receipt.read()
    receipt_data = base64.b64encode(content).decode('utf-8')
    receipt_url = f"data:{receipt.content_type};base64,{receipt_data}"
    
    await db.deposits.update_one(
        {"id": deposit_id},
        {"$set": {"receipt_url": receipt_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Receipt uploaded successfully"}

@api_router.get("/cashbank/deposits")
async def get_user_deposits(user: dict = Depends(get_current_user)):
    deposits = await db.deposits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return deposits

# ============== WITHDRAWAL ROUTES ==============

@api_router.post("/cashbank/withdrawal")
async def create_withdrawal(withdrawal: WithdrawalCreate, user: dict = Depends(get_current_user)):
    if withdrawal.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if current_user["cashbank"] < withdrawal.amount:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Tenés ${current_user['cashbank']}")
    
    withdrawal_id = str(uuid.uuid4())
    withdrawal_doc = {
        "id": withdrawal_id,
        "user_id": user["id"],
        "username": user["username"],
        "amount": withdrawal.amount,
        "alias": withdrawal.alias,
        "titular_name": withdrawal.titular_name,
        "user_balance_at_request": current_user["cashbank"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    await db.withdrawals.insert_one(withdrawal_doc)
    return {"id": withdrawal_id, "status": "pending", "message": "Solicitud de retiro creada"}

@api_router.get("/cashbank/withdrawals")
async def get_user_withdrawals(user: dict = Depends(get_current_user)):
    withdrawals = await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return withdrawals

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/deposits")
async def get_all_deposits(status: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    query = {}
    if status:
        query["status"] = status
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return deposits

@api_router.put("/admin/deposits/{deposit_id}")
async def update_deposit_status(deposit_id: str, update: DepositUpdate, admin: dict = Depends(get_admin_user)):
    deposit = await db.deposits.find_one({"id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Deposit already processed")
    
    await db.deposits.update_one(
        {"id": deposit_id},
        {"$set": {"status": update.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if update.status == "approved":
        await db.users.update_one(
            {"id": deposit["user_id"]},
            {"$inc": {"cashbank": deposit["amount"]}}
        )
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "deposit",
            "amount": deposit["amount"],
            "description": f"Deposit approved - ID: {deposit_id}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": f"Deposit {update.status}"}

@api_router.get("/admin/withdrawals")
async def get_all_withdrawals(status: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    query = {}
    if status:
        query["status"] = status
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return withdrawals

@api_router.put("/admin/withdrawals/{withdrawal_id}")
async def update_withdrawal_status(withdrawal_id: str, update: WithdrawalUpdate, admin: dict = Depends(get_admin_user)):
    withdrawal = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    user = await db.users.find_one({"id": withdrawal["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update.status == "approved":
        if user["cashbank"] < withdrawal["amount"]:
            raise HTTPException(status_code=400, detail=f"Usuario no tiene saldo suficiente. Saldo actual: ${user['cashbank']}")
        
        await db.users.update_one(
            {"id": withdrawal["user_id"]},
            {"$inc": {"cashbank": -withdrawal["amount"]}}
        )
        
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": withdrawal["user_id"],
            "type": "withdrawal",
            "amount": -withdrawal["amount"],
            "description": f"Retiro aprobado a {withdrawal['alias']} ({withdrawal['titular_name']})",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.withdrawals.update_one(
        {"id": withdrawal_id},
        {"$set": {"status": update.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Retiro {update.status}"}

@api_router.put("/admin/transfer-data")
async def update_transfer_data(data: TransferDataUpdate, admin: dict = Depends(get_admin_user)):
    await db.settings.update_one(
        {"type": "transfer_data"},
        {"$set": {
            "type": "transfer_data",
            "titular": data.titular,
            "banco": data.banco,
            "alias": data.alias,
            "cbu_cvu": data.cbu_cvu,
            "tipo_cuenta": data.tipo_cuenta
        }},
        upsert=True
    )
    return {"message": "Transfer data updated"}

@api_router.get("/admin/settings")
async def get_admin_settings(admin: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"type": "admin_settings"}, {"_id": 0})
    if not settings:
        return {"private_table_cost": 100.0, "platform_commission": 30.0}
    return settings

@api_router.put("/admin/settings")
async def update_admin_settings(settings: AdminSettings, admin: dict = Depends(get_admin_user)):
    await db.settings.update_one(
        {"type": "admin_settings"},
        {"$set": {
            "type": "admin_settings",
            "private_table_cost": settings.private_table_cost,
            "platform_commission": settings.platform_commission
        }},
        upsert=True
    )
    return {"message": "Settings updated"}

@api_router.get("/admin/users")
async def get_all_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api_router.put("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_suspended": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User suspended"}

@api_router.put("/admin/users/{user_id}/unsuspend")
async def unsuspend_user(user_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_suspended": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User unsuspended"}

# ============== TABLE ROUTES ==============

@api_router.post("/tables/public")
async def create_public_table(table: TableCreate, admin: dict = Depends(get_admin_user)):
    table_id = str(uuid.uuid4())
    modality_players = {"1v1": 2, "2v2": 4, "3v3": 6}
    
    table_doc = {
        "id": table_id,
        "modality": table.modality,
        "entry_cost": table.entry_cost,
        "max_players": modality_players.get(table.modality, 2),
        "with_flor": table.with_flor,
        "points_to_win": table.points_to_win,
        "is_private": False,
        "code": None,
        "players": [],
        "status": "waiting",
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tables.insert_one(table_doc)
    return {"id": table_id, "message": "Public table created"}

@api_router.post("/tables/private")
async def create_private_table(table: PrivateTableCreate, user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"type": "admin_settings"}, {"_id": 0})
    private_cost = settings.get("private_table_cost", 100.0) if settings else 100.0
    total_cost = private_cost + table.entry_cost
    
    if user["cashbank"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${total_cost}")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": -total_cost}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "table_creation",
        "amount": -total_cost,
        "description": f"Private table creation + entry",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    table_id = str(uuid.uuid4())
    code = generate_table_code()
    modality_players = {"1v1": 2, "2v2": 4, "3v3": 6}
    
    table_doc = {
        "id": table_id,
        "modality": table.modality,
        "entry_cost": table.entry_cost,
        "max_players": modality_players.get(table.modality, 2),
        "with_flor": table.with_flor,
        "points_to_win": table.points_to_win,
        "is_private": True,
        "code": code,
        "players": [{"id": user["id"], "username": user["username"], "team": 1}],
        "status": "waiting",
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tables.insert_one(table_doc)
    
    return {
        "id": table_id,
        "code": code,
        "invite_link": f"/join/{code}",
        "message": "Private table created"
    }

@api_router.get("/tables")
async def get_available_tables(user: dict = Depends(get_current_user)):
    tables = await db.tables.find(
        {"is_private": False, "status": "waiting"},
        {"_id": 0}
    ).to_list(50)
    return tables

@api_router.get("/tables/{table_id}")
async def get_table(table_id: str, user: dict = Depends(get_current_user)):
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table

@api_router.post("/tables/{table_id}/join")
async def join_table(table_id: str, user: dict = Depends(get_current_user)):
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Table is not accepting players")
    
    if any(p["id"] == user["id"] for p in table["players"]):
        raise HTTPException(status_code=400, detail="Already joined this table")
    
    if len(table["players"]) >= table["max_players"]:
        raise HTTPException(status_code=400, detail="Table is full")
    
    if user["cashbank"] < table["entry_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": -table["entry_cost"]}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "table_entry",
        "amount": -table["entry_cost"],
        "description": f"Entry to table {table_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    current_players = len(table["players"])
    team = (current_players % 2) + 1 if table["modality"] != "1v1" else current_players + 1
    
    await db.tables.update_one(
        {"id": table_id},
        {"$push": {"players": {"id": user["id"], "username": user["username"], "team": team}}}
    )
    
    updated_table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if len(updated_table["players"]) >= table["max_players"]:
        await db.tables.update_one({"id": table_id}, {"$set": {"status": "playing"}})
        await create_game(table_id)
        
        if not table.get("is_private", False) and not table.get("tournament_id"):
            await regenerate_public_table(table)
    
    return {"message": "Joined table successfully", "table_id": table_id}

async def regenerate_public_table(original_table: dict):
    table_id = str(uuid.uuid4())
    table_doc = {
        "id": table_id,
        "modality": original_table["modality"],
        "entry_cost": original_table["entry_cost"],
        "max_players": original_table["max_players"],
        "with_flor": original_table["with_flor"],
        "points_to_win": original_table["points_to_win"],
        "is_private": False,
        "code": None,
        "players": [],
        "status": "waiting",
        "created_by": original_table.get("created_by"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tables.insert_one(table_doc)
    logger.info(f"Auto-regenerated public table: {table_id}")

@api_router.post("/tables/join-by-code")
async def join_by_code(request: JoinTableRequest, user: dict = Depends(get_current_user)):
    if not request.code:
        raise HTTPException(status_code=400, detail="Code required")
    
    table = await db.tables.find_one({"code": request.code.upper()}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return await join_table(table["id"], user)

# ============== TOURNAMENT ROUTES ==============
# (Mantenidos igual ya que la lógica principal de torneo no tenía bugs reportados)
@api_router.post("/tournaments")
async def create_tournament(tournament: TournamentCreate, admin: dict = Depends(get_admin_user)):
    modality_players = {"1v1": 2, "2v2": 4, "3v3": 6}
    players_per_table = modality_players.get(tournament.modality, 2)
    total_players = tournament.num_tables * players_per_table
    
    tournament_id = str(uuid.uuid4())
    tournament_doc = {
        "id": tournament_id,
        "name": tournament.name,
        "modality": tournament.modality,
        "num_tables": tournament.num_tables,
        "entry_cost": tournament.entry_cost,
        "with_flor": tournament.with_flor,
        "points_to_win": tournament.points_to_win,
        "first_place_percentage": tournament.first_place_percentage,
        "second_place_percentage": tournament.second_place_percentage,
        "platform_commission": 30.0,
        "players_per_table": players_per_table,
        "total_players": total_players,
        "registered_players": [],
        "tables": [],
        "status": "registration",
        "current_round": 0,
        "winners": [],
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tournaments.insert_one(tournament_doc)
    return {"id": tournament_id, "message": f"Torneo creado - {total_players} jugadores necesarios"}

@api_router.get("/tournaments")
async def get_tournaments(user: dict = Depends(get_current_user)):
    tournaments = await db.tournaments.find(
        {"status": {"$in": ["registration", "in_progress"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return tournaments

@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str, user: dict = Depends(get_current_user)):
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament

@api_router.post("/tournaments/{tournament_id}/join")
async def join_tournament(tournament_id: str, user: dict = Depends(get_current_user)):
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament["status"] != "registration":
        raise HTTPException(status_code=400, detail="El torneo ya no acepta registros")
    if any(p["id"] == user["id"] for p in tournament["registered_players"]):
        raise HTTPException(status_code=400, detail="Ya estás registrado en este torneo")
    if len(tournament["registered_players"]) >= tournament["total_players"]:
        raise HTTPException(status_code=400, detail="Torneo completo")
    
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if current_user["cashbank"] < tournament["entry_cost"]:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": -tournament["entry_cost"]}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "tournament_entry",
        "amount": -tournament["entry_cost"],
        "description": f"Inscripción torneo: {tournament['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    players_per_team = {"1v1": 1, "2v2": 2, "3v3": 3}
    team_size = players_per_team.get(tournament["modality"], 1)
    current_count = len(tournament["registered_players"])
    team_number = (current_count // team_size) + 1
    team_position = (current_count % team_size) + 1
    
    player_entry = {
        "id": user["id"],
        "username": user["username"],
        "team_number": team_number,
        "team_position": team_position,
        "status": "waiting_team" if team_size > 1 and team_position < team_size else "ready",
        "registered_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$push": {"registered_players": player_entry}}
    )
    
    updated_tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if len(updated_tournament["registered_players"]) >= tournament["total_players"]:
        await start_tournament(tournament_id)
    
    status = "esperando equipo" if player_entry["status"] == "waiting_team" else "esperando completar mesas"
    return {"message": f"Registrado en torneo - {status}"}

@api_router.post("/tournaments/{tournament_id}/cancel")
async def cancel_tournament_registration(tournament_id: str, user: dict = Depends(get_current_user)):
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament["status"] != "registration":
        raise HTTPException(status_code=400, detail="No se puede cancelar después de iniciado el torneo")
    
    player = next((p for p in tournament["registered_players"] if p["id"] == user["id"]), None)
    if not player:
        raise HTTPException(status_code=400, detail="No estás registrado en este torneo")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": tournament["entry_cost"]}})
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "tournament_refund",
        "amount": tournament["entry_cost"],
        "description": f"Reembolso torneo: {tournament['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$pull": {"registered_players": {"id": user["id"]}}}
    )
    return {"message": "Registro cancelado - Monto reembolsado"}

async def start_tournament(tournament_id: str):
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        return
    
    players = tournament["registered_players"]
    tables = []
    players_per_table = tournament["players_per_table"]
    
    for i in range(tournament["num_tables"]):
        table_players = players[i * players_per_table:(i + 1) * players_per_table]
        
        table_id = str(uuid.uuid4())
        table_doc = {
            "id": table_id,
            "tournament_id": tournament_id,
            "modality": tournament["modality"],
            "entry_cost": 0,
            "max_players": players_per_table,
            "with_flor": tournament["with_flor"],
            "points_to_win": tournament["points_to_win"],
            "is_private": True,
            "code": None,
            "players": [
                {"id": p["id"], "username": p["username"], "team": (idx % 2) + 1}
                for idx, p in enumerate(table_players)
            ],
            "status": "playing",
            "round": 1,
            "created_by": tournament["created_by"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tables.insert_one(table_doc)
        tables.append({"table_id": table_id, "round": 1})
        await create_game(table_id)
    
    await db.tournaments.update_one(
        {"id": tournament_id},
        {
            "$set": {
                "status": "in_progress",
                "tables": tables,
                "current_round": 1,
                "started_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    await sio.emit('tournament_started', {"tournament_id": tournament_id})

@api_router.get("/admin/tournaments")
async def get_all_tournaments(admin: dict = Depends(get_admin_user)):
    tournaments = await db.tournaments.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tournaments

# ============== GAME LOGIC ==============

SPANISH_DECK = [
    {"number": 1, "suit": "espadas", "value": 14},
    {"number": 1, "suit": "bastos", "value": 13},
    {"number": 7, "suit": "espadas", "value": 12},
    {"number": 7, "suit": "oros", "value": 11},
    {"number": 3, "suit": "espadas", "value": 10},
    {"number": 3, "suit": "bastos", "value": 10},
    {"number": 3, "suit": "oros", "value": 10},
    {"number": 3, "suit": "copas", "value": 10},
    {"number": 2, "suit": "espadas", "value": 9},
    {"number": 2, "suit": "bastos", "value": 9},
    {"number": 2, "suit": "oros", "value": 9},
    {"number": 2, "suit": "copas", "value": 9},
    {"number": 1, "suit": "oros", "value": 8},
    {"number": 1, "suit": "copas", "value": 8},
    {"number": 12, "suit": "espadas", "value": 7},
    {"number": 12, "suit": "bastos", "value": 7},
    {"number": 12, "suit": "oros", "value": 7},
    {"number": 12, "suit": "copas", "value": 7},
    {"number": 11, "suit": "espadas", "value": 6},
    {"number": 11, "suit": "bastos", "value": 6},
    {"number": 11, "suit": "oros", "value": 6},
    {"number": 11, "suit": "copas", "value": 6},
    {"number": 10, "suit": "espadas", "value": 5},
    {"number": 10, "suit": "bastos", "value": 5},
    {"number": 10, "suit": "oros", "value": 5},
    {"number": 10, "suit": "copas", "value": 5},
    {"number": 7, "suit": "bastos", "value": 4},
    {"number": 7, "suit": "copas", "value": 4},
    {"number": 6, "suit": "espadas", "value": 3},
    {"number": 6, "suit": "bastos", "value": 3},
    {"number": 6, "suit": "oros", "value": 3},
    {"number": 6, "suit": "copas", "value": 3},
    {"number": 5, "suit": "espadas", "value": 2},
    {"number": 5, "suit": "bastos", "value": 2},
    {"number": 5, "suit": "oros", "value": 2},
    {"number": 5, "suit": "copas", "value": 2},
    {"number": 4, "suit": "espadas", "value": 1},
    {"number": 4, "suit": "bastos", "value": 1},
    {"number": 4, "suit": "oros", "value": 1},
    {"number": 4, "suit": "copas", "value": 1},
]

def calculate_envido_points(cards):
    suits = {}
    for card in cards:
        suit = card["suit"]
        if suit not in suits:
            suits[suit] = []
        envido_value = card["number"] if card["number"] <= 7 else 0
        suits[suit].append(envido_value)
    
    max_points = 0
    for suit, values in suits.items():
        if len(values) >= 2:
            values.sort(reverse=True)
            points = values[0] + values[1] + 20
            max_points = max(max_points, points)
        elif len(values) == 1:
            max_points = max(max_points, values[0])
    return max_points

def check_flor(cards):
    suits = {}
    for card in cards:
        suit = card["suit"]
        suits[suit] = suits.get(suit, 0) + 1
    return any(count == 3 for count in suits.values())

def calculate_flor_points(cards):
    total = 0
    for card in cards:
        if card["number"] <= 7:
            total += card["number"]
    return total + 20

async def create_game(table_id: str):
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        return
    
    game_id = str(uuid.uuid4())
    deck = SPANISH_DECK.copy()
    random.shuffle(deck)
    
    players_hands = {}
    for i, player in enumerate(table["players"]):
        hand = deck[i*3:(i+1)*3]
        has_flor = check_flor(hand) if table["with_flor"] else False
        players_hands[player["id"]] = {
            "cards": hand,
            "played_cards": [],
            "envido_points": calculate_envido_points(hand),
            "has_flor": has_flor,
            "flor_points": calculate_flor_points(hand) if has_flor else 0,
            "flor_announced": False
        }
    
    mano_index = random.randint(0, len(table["players"]) - 1)
    
    game_doc = {
        "id": game_id,
        "table_id": table_id,
        "players": table["players"],
        "players_hands": players_hands,
        "team1_score": 0,
        "team2_score": 0,
        "current_round": 1,
        "current_hand": 1,
        "mano_player_id": table["players"][mano_index]["id"],
        "current_turn": table["players"][mano_index]["id"],
        "round_cards": [],
        "hand_results": [],
        "first_card_played": False,
        "truco_state": None,
        "truco_caller": None,
        "truco_caller_team": None,
        "truco_points": 1,
        "truco_pending_response": False,
        "envido_state": None,
        "envido_points": 0,
        "envido_rejected_points": 1,
        "envido_caller": None,
        "envido_caller_team": None,
        "envido_pending_response": False,
        "envido_resolved": False,
        "flor_state": None,
        "flor_points": 0,
        "flor_resolved": False,
        "status": "playing",
        "points_to_win": table["points_to_win"],
        "with_flor": table["with_flor"],
        "modality": table["modality"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.games.insert_one(game_doc)
    await sio.emit('game_started', {"game_id": game_id, "table_id": table_id}, room=table_id)
    return game_id

@api_router.get("/games/{game_id}")
async def get_game(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    user_id = user["id"]
    response = {**game}
    filtered_hands = {}
    for player_id, hand in game["players_hands"].items():
        if player_id == user_id:
            filtered_hands[player_id] = hand
        else:
            filtered_hands[player_id] = {
                "cards": [{"hidden": True} for _ in hand["cards"]],
                "played_cards": hand["played_cards"],
                "envido_points": None,
                "has_flor": hand.get("has_flor", False)
            }
    response["players_hands"] = filtered_hands
    return response

@api_router.get("/games/table/{table_id}")
async def get_game_by_table(table_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"table_id": table_id, "status": "playing"}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="No active game found")
    return await get_game(game["id"], user)

# ============== CHAT Y OTROS (se mantienen igual) ==============
@api_router.post("/chat/global")
async def send_global_message(message: ChatMessage, user: dict = Depends(get_current_user)):
    msg_doc = {
        "id": str(uuid.uuid4()),
        "type": "global",
        "sender_id": user["id"],
        "sender_username": user["username"],
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg_doc)
    await sio.emit('global_message', msg_doc)
    return {"message": "Message sent"}

@api_router.get("/chat/global")
async def get_global_messages(limit: int = 50):
    messages = await db.messages.find({"type": "global"}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return list(reversed(messages))

@api_router.post("/chat/private")
async def send_private_message(message: ChatMessage, user: dict = Depends(get_current_user)):
    if not message.recipient_id:
        raise HTTPException(status_code=400, detail="Recipient required")
    msg_doc = {
        "id": str(uuid.uuid4()),
        "type": "private",
        "sender_id": user["id"],
        "sender_username": user["username"],
        "recipient_id": message.recipient_id,
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg_doc)
    await sio.emit('private_message', msg_doc, room=f"user_{message.recipient_id}")
    return {"message": "Message sent"}

@api_router.get("/chat/private/{user_id}")
async def get_private_messages(user_id: str, user: dict = Depends(get_current_user)):
    messages = await db.messages.find(
        {
            "type": "private",
            "$or": [
                {"sender_id": user["id"], "recipient_id": user_id},
                {"sender_id": user_id, "recipient_id": user["id"]}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    return list(reversed(messages))

@api_router.get("/history/games")
async def get_game_history(user: dict = Depends(get_current_user)):
    games = await db.games.find(
        {"players.id": user["id"], "status": "finished"},
        {"_id": 0, "players_hands": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return games

@api_router.get("/history/transactions")
async def get_transaction_history(user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    return transactions

@api_router.get("/admin/games")
async def get_all_games(status: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    query = {}
    if status: query["status"] = status
    games = await db.games.find(query, {"_id": 0, "players_hands": 0}).sort("created_at", -1).to_list(100)
    return games

@api_router.get("/admin/tables")
async def get_all_tables(admin: dict = Depends(get_admin_user)):
    tables = await db.tables.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tables


# ============== SOCKET.IO EVENTS Y LÓGICA DE JUEGO MEJORADA ==============

connected_users = {}

@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Client connected: {sid}")
    if auth and "token" in auth:
        try:
            payload = jwt.decode(auth["token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                connected_users[sid] = user_id
                await sio.enter_room(sid, f"user_{user_id}")
                logger.info(f"User {user_id} authenticated")
        except Exception as e:
            logger.error(f"Auth error: {e}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in connected_users:
        del connected_users[sid]

@sio.event
async def join_table_room(sid, data):
    table_id = data.get("table_id")
    if table_id:
        await sio.enter_room(sid, table_id)

@sio.event
async def leave_table_room(sid, data):
    table_id = data.get("table_id")
    if table_id:
        await sio.leave_room(sid, table_id)

def determine_hand_winner(round_cards, players, mano_player_id):
    """
    Determina el ganador de la mano. Si hay un empate (Parda), no gana nadie.
    Devuelve (winner_player, winner_team, is_parda)
    """
    if not round_cards:
        return None, None, False
    
    max_value = max(c["card"]["value"] for c in round_cards)
    tied_cards = [c for c in round_cards if c["card"]["value"] == max_value]
    
    if len(tied_cards) == 1:
        winner_id = tied_cards[0]["player_id"]
        winner_player = next(p for p in players if p["id"] == winner_id)
        return winner_player, winner_player["team"], False
    
    # PARDA: El empate verdadero. Retornamos None para indicar que nadie ganó la mano.
    return None, None, True

def calculate_round_winner(hand_results, mano_player_id, players):
    """
    Lógica de victorias de ronda con Pardas integradas:
    - Parda en la 1ra, define el ganador de la 2da.
    - Parda en 1ra y 2da, define la 3ra.
    - Triple parda, gana el Mano.
    - Ganar 1ra, parda en 2da (o 3ra), gana el de la 1ra.
    """
    if not hand_results:
        return None
        
    wins = {1: 0, 2: 0}
    pardas = 0
    first_winner = None
    
    for res in hand_results:
        if res.get("is_parda", False):
            pardas += 1
        else:
            team = res["winner_team"]
            wins[team] += 1
            if first_winner is None:
                first_winner = team

    # Ganar 2 de 3
    if wins[1] >= 2: return 1
    if wins[2] >= 2: return 2
    
    # Después de 2 manos jugadas
    if len(hand_results) == 2:
        # Ganador de 1ra + parda en 2da = Ganador de la 1ra
        if pardas == 1 and first_winner is not None:
            return first_winner
        # Parda en 1ra + Ganador de 2da = Ganador de la 2da
        if hand_results[0].get("is_parda") and not hand_results[1].get("is_parda"):
            return hand_results[1]["winner_team"]
            
    # Después de 3 manos jugadas (si llegamos acá, nadie tiene 2 wins)
    if len(hand_results) == 3:
        if wins[1] > wins[2]: return 1
        if wins[2] > wins[1]: return 2
        
        # Un ganador y dos pardas o 1 a 1 y 1 parda
        if first_winner is not None:
            return first_winner
            
        # Triple Parda: Gana el Mano
        if pardas == 3:
            mano = next(p for p in players if p["id"] == mano_player_id)
            return mano["team"]

    return None

@sio.event
async def play_card(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    card_index = data.get("card_index")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        return {"error": "Game not found"}
    
    if game["current_turn"] != user_id:
        return {"error": "Not your turn"}
    
    if game.get("truco_pending_response") or game.get("envido_pending_response"):
        return {"error": "Waiting for response to call"}
    
    player_hand = game["players_hands"].get(user_id)
    if not player_hand or card_index >= len(player_hand["cards"]):
        return {"error": "Invalid card"}
    
    card = player_hand["cards"].pop(card_index)
    player_hand["played_cards"].append(card)
    
    game["round_cards"].append({
        "player_id": user_id,
        "card": card
    })
    
    if not game.get("first_card_played"):
        game["first_card_played"] = True
    
    players = game["players"]
    current_index = next(i for i, p in enumerate(players) if p["id"] == user_id)
    next_index = (current_index + 1) % len(players)
    
    # Si la mano está completa
    if len(game["round_cards"]) == len(players):
        winner_player, winner_team, is_parda = determine_hand_winner(
            game["round_cards"], 
            players, 
            game["mano_player_id"]
        )
        
        game["hand_results"].append({
            "winner_id": winner_player["id"] if winner_player else None,
            "winner_team": winner_team,
            "is_parda": is_parda,
            "cards": game["round_cards"].copy()
        })
        
        round_winner = calculate_round_winner(
            game["hand_results"], 
            game["mano_player_id"],
            players
        )
        
        if round_winner is not None:
            points = game["truco_points"]
            if round_winner == 1:
                game["team1_score"] += points
            else:
                game["team2_score"] += points
            
            if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
                game["status"] = "finished"
                final_winner = 1 if game["team1_score"] >= game["points_to_win"] else 2
                
                await db.games.update_one(
                    {"id": game_id},
                    {"$set": {
                        "players_hands": game["players_hands"],
                        "round_cards": [],
                        "hand_results": game["hand_results"],
                        "team1_score": game["team1_score"],
                        "team2_score": game["team2_score"],
                        "status": "finished",
                        "first_card_played": game["first_card_played"]
                    }}
                )
                await finish_game(game, final_winner)
                await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
                return {"success": True}
            else:
                await start_new_round(game)
                await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
                return {"success": True}
        else:
            # Siguiente mano: el ganador arranca, o si hubo parda, el "mano" u original vuelve a empezar
            game["round_cards"] = []
            if winner_player:
                game["current_turn"] = winner_player["id"]
            else:
                # Si es parda, el turno vuelve al mano de esta ronda
                game["current_turn"] = game["mano_player_id"]
            game["current_hand"] += 1
    else:
        game["current_turn"] = players[next_index]["id"]
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "players_hands": game["players_hands"],
            "round_cards": game["round_cards"],
            "hand_results": game["hand_results"],
            "current_turn": game["current_turn"],
            "current_hand": game["current_hand"],
            "team1_score": game["team1_score"],
            "team2_score": game["team2_score"],
            "truco_points": game["truco_points"],
            "status": game["status"],
            "first_card_played": game["first_card_played"]
        }}
    )
    await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
    return {"success": True}

@sio.event
async def call_truco(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    call_type = data.get("call_type")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["status"] != "playing":
        return {"error": "Game not in progress"}
    
    caller = next((p for p in game["players"] if p["id"] == user_id), None)
    if not caller: return {"error": "Not in this game"}
    
    caller_team = caller["team"]
    current_state = game.get("truco_state")
    current_caller_team = game.get("truco_caller_team")
    
    if game.get("truco_pending_response"):
        if caller_team == current_caller_team:
            return {"error": "Esperando respuesta del oponente"}
    
    if call_type == "truco":
        if current_state is not None:
            return {"error": "Ya se cantó truco"}
    elif call_type == "retruco":
        if current_state != "truco":
            return {"error": "Primero hay que cantar truco"}
        if caller_team == current_caller_team:
            return {"error": "No podés subir tu propia apuesta"}
    elif call_type == "vale_cuatro":
        if current_state != "retruco":
            return {"error": "Primero hay que cantar retruco"}
        if caller_team == current_caller_team:
            return {"error": "No podés subir tu propia apuesta"}
    else:
        return {"error": "Invalid call type"}
    
    points_map = {"truco": 2, "retruco": 3, "vale_cuatro": 4}
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "truco_state": call_type,
            "truco_caller": user_id,
            "truco_caller_team": caller_team,
            "truco_points": points_map[call_type],
            "truco_pending_response": True
        }}
    )
    
    await sio.emit('truco_called', {
        "game_id": game_id,
        "caller_id": user_id,
        "caller_username": caller.get("username", "Jugador"),
        "caller_team": caller_team,
        "call_type": call_type,
        "points": points_map[call_type]
    }, room=game["table_id"])
    return {"success": True}

@sio.event
async def respond_truco(sid, data):
    user_id = connected_users.get(sid)
    if not user_id: return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    response = data.get("response")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or not game.get("truco_pending_response"):
        return {"error": "No pending truco call"}
    
    responder = next((p for p in game["players"] if p["id"] == user_id), None)
    if not responder or responder["team"] == game.get("truco_caller_team"):
        return {"error": "Solo el equipo contrario puede responder"}
    
    if response == "no_quiero":
        # Se lleva los puntos del nivel ANTERIOR el equipo que cantó
        prev_points = {"truco": 1, "retruco": 2, "vale_cuatro": 3}
        points = prev_points.get(game["truco_state"], 1)
        caller_team = game.get("truco_caller_team")
        
        if caller_team == 1: game["team1_score"] += points
        else: game["team2_score"] += points
        
        game_finished = False
        winner_team = None
        if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
            game["status"] = "finished"
            winner_team = 1 if game["team1_score"] >= game["points_to_win"] else 2
            game_finished = True
        
        await db.games.update_one(
            {"id": game_id},
            {"$set": {
                "team1_score": game["team1_score"],
                "team2_score": game["team2_score"],
                "status": "finished" if game_finished else "playing",
                "truco_state": None,
                "truco_pending_response": False
            }}
        )
        
        await sio.emit('truco_response', {
            "game_id": game_id,
            "responder_id": user_id,
            "response": response,
            "points_awarded": points,
            "winner_team": caller_team,
            "game_finished": game_finished
        }, room=game["table_id"])
        
        if game_finished:
            await finish_game(game, winner_team)
            return {"success": True, "game_finished": True}
        else:
            await start_new_round(game)
            await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
            
    elif response == "quiero":
        await db.games.update_one({"id": game_id}, {"$set": {"truco_pending_response": False}})
        await sio.emit('truco_response', {
            "game_id": game_id,
            "responder_id": user_id,
            "response": response,
            "current_points": game["truco_points"]
        }, room=game["table_id"])
    
    return {"success": True}

@sio.event
async def call_envido(sid, data):
    user_id = connected_users.get(sid)
    if not user_id: return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    call_type = data.get("call_type")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["status"] != "playing":
        return {"error": "Game not in progress"}
    
    if game.get("first_card_played", False):
        return {"error": "El envido solo se puede cantar antes de jugar la primera carta"}
    if game.get("envido_resolved", False):
        return {"error": "El envido ya fue jugado en esta ronda"}
    
    caller = next((p for p in game["players"] if p["id"] == user_id), None)
    if not caller: return {"error": "Not in this game"}
    
    caller_team = caller["team"]
    current_state = game.get("envido_state")
    current_caller_team = game.get("envido_caller_team")
    current_points = game.get("envido_points", 0)
    
    points_to_add = 0
    # Guardamos el acumulado anterior por si rechazan. Si no hay nada previo, vale 1.
    rejected_points = current_points if current_points > 0 else 1
    
    if call_type == "envido":
        if current_state == "real_envido" or current_state == "falta_envido":
            return {"error": "Secuencia de envido inválida"}
        points_to_add = 2
    elif call_type == "real_envido":
        if current_state == "falta_envido":
            return {"error": "Secuencia inválida"}
        points_to_add = 3
    elif call_type == "falta_envido":
        # Falta Envido: Lo que le falta al lider para ganar
        leader_score = max(game["team1_score"], game["team2_score"])
        points_to_add = game["points_to_win"] - leader_score
    else:
        return {"error": "Invalid call type"}
    
    if current_state and caller_team == current_caller_team:
        return {"error": "No podés subir tu propia apuesta de envido"}
    
    new_points = current_points + points_to_add
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "envido_state": call_type,
            "envido_caller": user_id,
            "envido_caller_team": caller_team,
            "envido_points": new_points,
            "envido_rejected_points": rejected_points,
            "envido_pending_response": True
        }}
    )
    
    await sio.emit('envido_called', {
        "game_id": game_id,
        "caller_id": user_id,
        "caller_username": caller.get("username", "Jugador"),
        "caller_team": caller_team,
        "call_type": call_type,
        "total_points": new_points
    }, room=game["table_id"])
    return {"success": True}

@sio.event
async def respond_envido(sid, data):
    user_id = connected_users.get(sid)
    if not user_id: return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    response = data.get("response")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or not game.get("envido_pending_response"):
        return {"error": "No pending envido call"}
    
    responder = next((p for p in game["players"] if p["id"] == user_id), None)
    if not responder or responder["team"] == game.get("envido_caller_team"):
        return {"error": "Solo el equipo contrario puede responder"}
    
    caller_team = game.get("envido_caller_team")
    
    if response == "no_quiero":
        # Se suman los puntos rechazados guardados previamente
        awarded_points = game.get("envido_rejected_points", 1)
        
        if caller_team == 1: game["team1_score"] += awarded_points
        else: game["team2_score"] += awarded_points
        
        game_finished = False
        winner_team = None
        if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
            winner_team = 1 if game["team1_score"] >= game["points_to_win"] else 2
            game["status"] = "finished"
            game_finished = True
        
        await db.games.update_one(
            {"id": game_id},
            {"$set": {
                "envido_state": None,
                "envido_pending_response": False,
                "envido_resolved": True,
                "team1_score": game["team1_score"],
                "team2_score": game["team2_score"],
                "status": "finished" if game_finished else "playing"
            }}
        )
        
        await sio.emit('envido_response', {
            "game_id": game_id,
            "responder_id": user_id,
            "response": response,
            "points_awarded": awarded_points,
            "winner_team": caller_team,
            "game_finished": game_finished
        }, room=game["table_id"])
        
        if game_finished:
            await finish_game(game, winner_team)
            return {"success": True, "game_finished": True}
            
    elif response == "quiero":
        players = game["players"]
        players_hands = game["players_hands"]
        
        team1_envido = max((players_hands.get(p["id"], {}).get("envido_points", 0) for p in players if p["team"] == 1), default=0)
        team2_envido = max((players_hands.get(p["id"], {}).get("envido_points", 0) for p in players if p["team"] == 2), default=0)
        
        points = game.get("envido_points", 2)
        if team1_envido > team2_envido: winner_team = 1
        elif team2_envido > team1_envido: winner_team = 2
        else:
            mano = next(p for p in players if p["id"] == game["mano_player_id"])
            winner_team = mano["team"]
        
        if winner_team == 1: game["team1_score"] += points
        else: game["team2_score"] += points
        
        game_finished = False
        final_winner = None
        if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
            final_winner = 1 if game["team1_score"] >= game["points_to_win"] else 2
            game["status"] = "finished"
            game_finished = True
            
        await db.games.update_one(
            {"id": game_id},
            {"$set": {
                "envido_state": None,
                "envido_pending_response": False,
                "envido_resolved": True,
                "team1_score": game["team1_score"],
                "team2_score": game["team2_score"],
                "status": "finished" if game_finished else "playing"
            }}
        )
        
        await sio.emit('envido_response', {
            "game_id": game_id,
            "responder_id": user_id,
            "response": response,
            "team1_envido": team1_envido,
            "team2_envido": team2_envido,
            "winner_team": winner_team,
            "points_awarded": points,
            "game_finished": game_finished
        }, room=game["table_id"])
        
        if game_finished:
            await finish_game(game, final_winner)
            return {"success": True, "game_finished": True}
            
    await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
    return {"success": True}

@sio.event
async def call_flor(sid, data):
    user_id = connected_users.get(sid)
    if not user_id: return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or not game.get("with_flor"): return {"error": "Flor no disponible"}
    if game.get("first_card_played"): return {"error": "La flor solo se puede cantar antes de jugar"}
    
    caller = next((p for p in game["players"] if p["id"] == user_id), None)
    if not caller: return {"error": "Not in this game"}
    
    player_hand = game["players_hands"].get(user_id, {})
    if not player_hand.get("has_flor"): return {"error": "No tenés flor"}
    if player_hand.get("flor_announced"): return {"error": "Ya cantaste flor"}
    
    # Cantar flor CANCELA cualquier envido pendiente automáticamente ("Con flor no hay envido")
    if game.get("envido_pending_response"):
        game["envido_pending_response"] = False
        game["envido_state"] = None
        game["envido_resolved"] = True
    
    game["players_hands"][user_id]["flor_announced"] = True
    caller_team = caller["team"]
    if caller_team == 1: game["team1_score"] += 3
    else: game["team2_score"] += 3
    
    game_finished = False
    winner_team = None
    if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
        winner_team = 1 if game["team1_score"] >= game["points_to_win"] else 2
        game["status"] = "finished"
        game_finished = True
        
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "players_hands": game["players_hands"],
            "envido_pending_response": game["envido_pending_response"],
            "envido_state": game["envido_state"],
            "envido_resolved": game.get("envido_resolved", False),
            "team1_score": game["team1_score"],
            "team2_score": game["team2_score"],
            "status": "finished" if game_finished else "playing"
        }}
    )
    
    await sio.emit('flor_called', {
        "game_id": game_id,
        "caller_id": user_id,
        "caller_username": caller.get("username", "Jugador"),
        "caller_team": caller_team,
        "points_awarded": 3,
        "flor_points": player_hand.get("flor_points", 0),
        "game_finished": game_finished
    }, room=game["table_id"])
    
    if game_finished:
        await finish_game(game, winner_team)
        return {"success": True, "game_finished": True}
        
    await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
    return {"success": True}

@sio.event
async def table_chat(sid, data):
    user_id = connected_users.get(sid)
    if not user_id: return
    table_id = data.get("table_id")
    message = data.get("message")
    is_team_only = data.get("is_team_only", False)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    msg_data = {
        "sender_id": user_id,
        "sender_username": user["username"],
        "message": message,
        "is_team_only": is_team_only,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if is_team_only:
        game = await db.games.find_one({"table_id": table_id, "status": "playing"}, {"_id": 0})
        if game:
            player_team = next((p["team"] for p in game["players"] if p["id"] == user_id), None)
            for pid in [p["id"] for p in game["players"] if p["team"] == player_team]:
                await sio.emit('table_chat', msg_data, room=f"user_{pid}")
    else:
        await sio.emit('table_chat', msg_data, room=table_id)

async def start_new_round(game):
    deck = SPANISH_DECK.copy()
    random.shuffle(deck)
    
    players_hands = {}
    for i, player in enumerate(game["players"]):
        hand = deck[i*3:(i+1)*3]
        has_flor = check_flor(hand) if game["with_flor"] else False
        players_hands[player["id"]] = {
            "cards": hand,
            "played_cards": [],
            "envido_points": calculate_envido_points(hand),
            "has_flor": has_flor,
            "flor_points": calculate_flor_points(hand) if has_flor else 0,
            "flor_announced": False
        }
    
    current_mano_index = next(i for i, p in enumerate(game["players"]) if p["id"] == game["mano_player_id"])
    new_mano_index = (current_mano_index + 1) % len(game["players"])
    new_mano = game["players"][new_mano_index]["id"]
    
    await db.games.update_one(
        {"id": game["id"]},
        {"$set": {
            "players_hands": players_hands,
            "current_round": game["current_round"] + 1,
            "current_hand": 1,
            "mano_player_id": new_mano,
            "current_turn": new_mano,
            "round_cards": [],
            "hand_results": [],
            "first_card_played": False,
            "truco_state": None,
            "truco_caller": None,
            "truco_caller_team": None,
            "truco_points": 1,
            "truco_pending_response": False,
            "envido_state": None,
            "envido_points": 0,
            "envido_rejected_points": 1,
            "envido_caller": None,
            "envido_caller_team": None,
            "envido_pending_response": False,
            "envido_resolved": False,
            "flor_state": None,
            "flor_points": 0,
            "flor_resolved": False
        }}
    )

async def finish_game(game, winner_team):
    table = await db.tables.find_one({"id": game["table_id"]}, {"_id": 0})
    if not table: return
    
    settings = await db.settings.find_one({"type": "admin_settings"}, {"_id": 0})
    commission = settings.get("platform_commission", 30) if settings else 30
    
    total_pot = table["entry_cost"] * len(table["players"])
    prize_pool = total_pot * (100 - commission) / 100
    
    winners = [p for p in game["players"] if p["team"] == winner_team]
    prize_per_winner = prize_pool / len(winners) if winners else 0
    
    for winner in winners:
        await db.users.update_one({"id": winner["id"]}, {"$inc": {"cashbank": prize_per_winner}})
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": winner["id"],
            "type": "game_win",
            "amount": prize_per_winner,
            "description": f"Won game {game['id']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.games.update_one(
        {"id": game["id"]},
        {"$set": {
            "status": "finished",
            "winner_team": winner_team,
            "prize_pool": prize_pool,
            "finished_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await db.tables.update_one({"id": game["table_id"]}, {"$set": {"status": "finished"}})
    
    await sio.emit('game_finished', {
        "game_id": game["id"],
        "winner_team": winner_team,
        "team1_score": game["team1_score"],
        "team2_score": game["team2_score"],
        "prize_per_winner": prize_per_winner
    }, room=game["table_id"])

# ============== ROOT ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "Truco Argentino API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tables.create_index("code")
    await db.games.create_index("table_id")
    
    admin = await db.users.find_one({"is_admin": True})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@trucoargentino.com",
            "password_hash": hash_password("admin123"),
            "cashbank": 10000.0,
            "is_admin": True,
            "is_suspended": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.mount("/socket.io", socket_app)
