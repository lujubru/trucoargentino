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
    # Check if user exists
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
    
    # Save receipt as base64
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
        # Create transaction record
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "deposit",
            "amount": deposit["amount"],
            "description": f"Deposit approved - ID: {deposit_id}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": f"Deposit {update.status}"}

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
        "status": "waiting",  # waiting, playing, finished
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tables.insert_one(table_doc)
    return {"id": table_id, "message": "Public table created"}

@api_router.post("/tables/private")
async def create_private_table(table: PrivateTableCreate, user: dict = Depends(get_current_user)):
    # Get settings for private table cost
    settings = await db.settings.find_one({"type": "admin_settings"}, {"_id": 0})
    private_cost = settings.get("private_table_cost", 100.0) if settings else 100.0
    total_cost = private_cost + table.entry_cost
    
    if user["cashbank"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${total_cost}")
    
    # Deduct costs
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": -total_cost}})
    
    # Create transaction
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
    # Get public tables that are waiting
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
    
    # Deduct entry cost
    await db.users.update_one({"id": user["id"]}, {"$inc": {"cashbank": -table["entry_cost"]}})
    
    # Create transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "table_entry",
        "amount": -table["entry_cost"],
        "description": f"Entry to table {table_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Assign team
    current_players = len(table["players"])
    team = (current_players % 2) + 1 if table["modality"] != "1v1" else current_players + 1
    
    # Add player
    await db.tables.update_one(
        {"id": table_id},
        {"$push": {"players": {"id": user["id"], "username": user["username"], "team": team}}}
    )
    
    # Check if table is full and should start
    updated_table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if len(updated_table["players"]) >= table["max_players"]:
        await db.tables.update_one({"id": table_id}, {"$set": {"status": "playing"}})
        # Create game
        await create_game(table_id)
    
    return {"message": "Joined table successfully"}

@api_router.post("/tables/join-by-code")
async def join_by_code(request: JoinTableRequest, user: dict = Depends(get_current_user)):
    if not request.code:
        raise HTTPException(status_code=400, detail="Code required")
    
    table = await db.tables.find_one({"code": request.code.upper()}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Use the regular join logic
    return await join_table(table["id"], user)

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
    """Calculate envido points for a hand of 3 cards."""
    suits = {}
    for card in cards:
        suit = card["suit"]
        if suit not in suits:
            suits[suit] = []
        # Cards 10, 11, 12 count as 0 for envido
        envido_value = card["number"] if card["number"] <= 7 else 0
        suits[suit].append(envido_value)
    
    max_points = 0
    for suit, values in suits.items():
        if len(values) >= 2:
            # Two or more cards of same suit: sum of two highest + 20
            values.sort(reverse=True)
            points = values[0] + values[1] + 20
            max_points = max(max_points, points)
        elif len(values) == 1:
            max_points = max(max_points, values[0])
    
    return max_points

def check_flor(cards):
    """Check if hand has flor (3 cards of same suit)."""
    suits = {}
    for card in cards:
        suit = card["suit"]
        suits[suit] = suits.get(suit, 0) + 1
    return any(count == 3 for count in suits.values())

async def create_game(table_id: str):
    """Create a new game for a table."""
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        return
    
    game_id = str(uuid.uuid4())
    
    # Shuffle and deal cards
    deck = SPANISH_DECK.copy()
    random.shuffle(deck)
    
    players_hands = {}
    for i, player in enumerate(table["players"]):
        hand = deck[i*3:(i+1)*3]
        players_hands[player["id"]] = {
            "cards": hand,
            "played_cards": [],
            "envido_points": calculate_envido_points(hand),
            "has_flor": check_flor(hand) if table["with_flor"] else False
        }
    
    # Random first player (mano)
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
        "round_cards": [],  # Cards played in current round
        "hand_results": [],  # Results of each hand (3 per round)
        "truco_state": None,  # None, "truco", "retruco", "vale_cuatro"
        "truco_caller": None,
        "truco_points": 1,
        "envido_state": None,
        "envido_points": 0,
        "envido_caller": None,
        "flor_state": None,
        "status": "playing",
        "points_to_win": table["points_to_win"],
        "with_flor": table["with_flor"],
        "modality": table["modality"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.games.insert_one(game_doc)
    
    # Emit game start event
    await sio.emit('game_started', {"game_id": game_id, "table_id": table_id}, room=table_id)
    
    return game_id

@api_router.get("/games/{game_id}")
async def get_game(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Only return user's own cards, hide others
    user_id = user["id"]
    response = {**game}
    
    # Filter hands to only show current user's cards
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

# ============== CHAT ROUTES ==============

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
    
    # Emit to all connected users
    await sio.emit('global_message', {
        "id": msg_doc["id"],
        "sender_id": user["id"],
        "sender_username": user["username"],
        "content": message.content,
        "created_at": msg_doc["created_at"]
    })
    
    return {"message": "Message sent"}

@api_router.get("/chat/global")
async def get_global_messages(limit: int = 50):
    messages = await db.messages.find(
        {"type": "global"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
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
    
    # Emit to recipient
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

@api_router.post("/chat/admin")
async def send_admin_message(message: ChatMessage, user: dict = Depends(get_current_user)):
    msg_doc = {
        "id": str(uuid.uuid4()),
        "type": "admin_support",
        "sender_id": user["id"],
        "sender_username": user["username"],
        "content": message.content,
        "is_from_admin": user.get("is_admin", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg_doc)
    return {"message": "Message sent to admin"}

@api_router.get("/chat/admin")
async def get_admin_messages(user: dict = Depends(get_current_user)):
    if user.get("is_admin"):
        # Admin sees all support messages
        messages = await db.messages.find(
            {"type": "admin_support"},
            {"_id": 0}
        ).sort("created_at", -1).limit(200).to_list(200)
    else:
        # User sees only their messages
        messages = await db.messages.find(
            {"type": "admin_support", "sender_id": user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50)
    return list(reversed(messages))

# ============== HISTORY ROUTES ==============

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

# ============== ADMIN GAME MANAGEMENT ==============

@api_router.get("/admin/games")
async def get_all_games(status: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    query = {}
    if status:
        query["status"] = status
    games = await db.games.find(query, {"_id": 0, "players_hands": 0}).sort("created_at", -1).to_list(100)
    return games

@api_router.get("/admin/tables")
async def get_all_tables(admin: dict = Depends(get_admin_user)):
    tables = await db.tables.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tables

# ============== SOCKET.IO EVENTS ==============

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
async def join_table(sid, data):
    table_id = data.get("table_id")
    if table_id:
        await sio.enter_room(sid, table_id)
        logger.info(f"Client {sid} joined table room {table_id}")

@sio.event
async def leave_table(sid, data):
    table_id = data.get("table_id")
    if table_id:
        await sio.leave_room(sid, table_id)

@sio.event
async def play_card(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    card_index = data.get("card_index")
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["current_turn"] != user_id:
        return {"error": "Not your turn"}
    
    player_hand = game["players_hands"].get(user_id)
    if not player_hand or card_index >= len(player_hand["cards"]):
        return {"error": "Invalid card"}
    
    # Play the card
    card = player_hand["cards"].pop(card_index)
    player_hand["played_cards"].append(card)
    
    # Add to round cards
    game["round_cards"].append({
        "player_id": user_id,
        "card": card
    })
    
    # Determine next turn
    players = game["players"]
    current_index = next(i for i, p in enumerate(players) if p["id"] == user_id)
    next_index = (current_index + 1) % len(players)
    
    # Check if hand is complete (all players played)
    if len(game["round_cards"]) == len(players):
        # Determine hand winner
        winning_card = max(game["round_cards"], key=lambda x: x["card"]["value"])
        winning_player = next(p for p in players if p["id"] == winning_card["player_id"])
        
        game["hand_results"].append({
            "winner_id": winning_player["id"],
            "winner_team": winning_player["team"],
            "cards": game["round_cards"]
        })
        
        # Check if round is complete (best of 3 hands)
        team1_wins = sum(1 for h in game["hand_results"] if h["winner_team"] == 1)
        team2_wins = sum(1 for h in game["hand_results"] if h["winner_team"] == 2)
        
        if team1_wins >= 2 or team2_wins >= 2 or len(game["hand_results"]) >= 3:
            # Round complete
            round_winner_team = 1 if team1_wins > team2_wins else 2
            points = game["truco_points"]
            
            if round_winner_team == 1:
                game["team1_score"] += points
            else:
                game["team2_score"] += points
            
            # Check game end
            if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
                game["status"] = "finished"
                winner_team = 1 if game["team1_score"] >= game["points_to_win"] else 2
                await finish_game(game, winner_team)
            else:
                # New round
                await start_new_round(game)
        else:
            # Next hand
            game["round_cards"] = []
            game["current_turn"] = winning_player["id"]
            game["current_hand"] += 1
    else:
        game["current_turn"] = players[next_index]["id"]
    
    # Update game in DB
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
            "status": game["status"]
        }}
    )
    
    # Emit game update
    await sio.emit('game_update', {"game_id": game_id}, room=game["table_id"])
    
    return {"success": True}

@sio.event
async def call_truco(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    call_type = data.get("call_type")  # truco, retruco, vale_cuatro
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        return {"error": "Game not found"}
    
    # Validate call
    valid_calls = {
        None: ["truco"],
        "truco": ["retruco"],
        "retruco": ["vale_cuatro"]
    }
    
    if call_type not in valid_calls.get(game["truco_state"], []):
        return {"error": "Invalid call"}
    
    points_map = {"truco": 2, "retruco": 3, "vale_cuatro": 4}
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "truco_state": call_type,
            "truco_caller": user_id,
            "truco_points": points_map[call_type]
        }}
    )
    
    await sio.emit('truco_called', {
        "game_id": game_id,
        "caller_id": user_id,
        "call_type": call_type
    }, room=game["table_id"])
    
    return {"success": True}

@sio.event
async def respond_truco(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    response = data.get("response")  # quiero, no_quiero
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or not game["truco_state"]:
        return {"error": "No truco to respond to"}
    
    if response == "no_quiero":
        # Opponent wins with previous points
        prev_points = {"truco": 1, "retruco": 2, "vale_cuatro": 3}
        points = prev_points.get(game["truco_state"], 1)
        
        caller_team = next(p["team"] for p in game["players"] if p["id"] == game["truco_caller"])
        
        if caller_team == 1:
            game["team1_score"] += points
        else:
            game["team2_score"] += points
        
        # Check game end
        if game["team1_score"] >= game["points_to_win"] or game["team2_score"] >= game["points_to_win"]:
            game["status"] = "finished"
            winner_team = 1 if game["team1_score"] >= game["points_to_win"] else 2
            await finish_game(game, winner_team)
        else:
            await start_new_round(game)
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "truco_state": None if response == "no_quiero" else game["truco_state"],
            "team1_score": game["team1_score"],
            "team2_score": game["team2_score"],
            "status": game["status"]
        }}
    )
    
    await sio.emit('truco_response', {
        "game_id": game_id,
        "responder_id": user_id,
        "response": response
    }, room=game["table_id"])
    
    return {"success": True}

@sio.event
async def call_envido(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return {"error": "Not authenticated"}
    
    game_id = data.get("game_id")
    call_type = data.get("call_type")  # envido, real_envido, falta_envido
    
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["current_hand"] != 1:
        return {"error": "Envido can only be called in first hand"}
    
    points_map = {
        "envido": 2,
        "real_envido": 3,
        "falta_envido": game["points_to_win"] - max(game["team1_score"], game["team2_score"])
    }
    
    new_points = game.get("envido_points", 0) + points_map.get(call_type, 0)
    
    await db.games.update_one(
        {"id": game_id},
        {"$set": {
            "envido_state": call_type,
            "envido_caller": user_id,
            "envido_points": new_points
        }}
    )
    
    await sio.emit('envido_called', {
        "game_id": game_id,
        "caller_id": user_id,
        "call_type": call_type
    }, room=game["table_id"])
    
    return {"success": True}

@sio.event
async def table_chat(sid, data):
    user_id = connected_users.get(sid)
    if not user_id:
        return
    
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
        # Get player's team
        game = await db.games.find_one({"table_id": table_id, "status": "playing"}, {"_id": 0})
        if game:
            player_team = next((p["team"] for p in game["players"] if p["id"] == user_id), None)
            team_players = [p["id"] for p in game["players"] if p["team"] == player_team]
            for pid in team_players:
                await sio.emit('table_chat', msg_data, room=f"user_{pid}")
    else:
        await sio.emit('table_chat', msg_data, room=table_id)

async def start_new_round(game):
    """Start a new round with fresh cards."""
    deck = SPANISH_DECK.copy()
    random.shuffle(deck)
    
    players_hands = {}
    for i, player in enumerate(game["players"]):
        hand = deck[i*3:(i+1)*3]
        players_hands[player["id"]] = {
            "cards": hand,
            "played_cards": [],
            "envido_points": calculate_envido_points(hand),
            "has_flor": check_flor(hand) if game["with_flor"] else False
        }
    
    # Rotate mano
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
            "truco_state": None,
            "truco_caller": None,
            "truco_points": 1,
            "envido_state": None,
            "envido_points": 0,
            "envido_caller": None
        }}
    )

async def finish_game(game, winner_team):
    """Finish game and distribute prizes."""
    table = await db.tables.find_one({"id": game["table_id"]}, {"_id": 0})
    if not table:
        return
    
    settings = await db.settings.find_one({"type": "admin_settings"}, {"_id": 0})
    commission = settings.get("platform_commission", 30) if settings else 30
    
    total_pot = table["entry_cost"] * len(table["players"])
    prize_pool = total_pot * (100 - commission) / 100
    
    winners = [p for p in game["players"] if p["team"] == winner_team]
    prize_per_winner = prize_pool / len(winners)
    
    for winner in winners:
        await db.users.update_one(
            {"id": winner["id"]},
            {"$inc": {"cashbank": prize_per_winner}}
        )
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
    
    await db.tables.update_one(
        {"id": game["table_id"]},
        {"$set": {"status": "finished"}}
    )
    
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

# Include the router
app.include_router(api_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tables.create_index("code")
    await db.games.create_index("table_id")
    
    # Create default admin if not exists
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
        logger.info("Default admin created: admin@trucoargentino.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Mount Socket.IO
app.mount("/socket.io", socket_app)
