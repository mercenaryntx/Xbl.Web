# Xbl.Web - Xbox Live Achievement Tracker

A 100% vibe-coded full-stack web application for tracking and analyzing Xbox Live achievements across multiple profiles, featuring advanced query capabilities with Kusto Query Language (KQL) support.

It's the Web version of the [Xbl](https://github.com/mercenaryntx/Xbl) console application.

## 🎮 Features

- **Multi-Profile Support**: Track achievements across multiple Xbox profiles
- **Achievement Browser**: Search, filter, and explore achievements with detailed statistics
- **Advanced Query Mode**: 
  - Pre-built queries for common analytics (rarest achievements, completion rates, time spent)
  - Custom Kusto Query Language (KQL) support for advanced data exploration
  - Multiple visualization options (tables, pie charts, line charts, bar charts)
  - Paginated results for large datasets
- **Real-time Data**: Automated nightly updates via Azure Pipelines
- **Rich Analytics**: Achievement rarity, weighted scores, game categories, and completion tracking
- **Image Management**: Automatic download and Azure Blob Storage hosting for game and achievement images

## 🏗️ Architecture

### Technology Stack

**Backend (.NET 8)**
- ASP.NET Core Web API
- Entity Framework Core with SQLite
- AutoMapper for object mapping
- KustoLoco for in-memory KQL query processing

**Frontend (React)**
- React 18 with Hooks
- Recharts for data visualization
- CSS3 with custom styling
- Responsive design

### Project Structure

```
Xbl.Web/
├── Xbl.Web/                    # ASP.NET Core web application
│   ├── Controllers/            # API controllers
│   ├── ClientApp/              # React frontend
│   │   └── src/
│   │       ├── components/     # React components
│   │       └── assets/         # Images and static files
│   └── Program.cs              # Application startup
│
├── Xbl.Web.Update/             # Console app for data updates
│   └── README.md               # Detailed update process docs
│
├── Xbl.Web.Shared/             # Shared infrastructure
│
└── ../Xbl/                     # Core libraries (separate repo)
    ├── Xbl.Client/             # Xbox Live API client
    ├── Xbl.Data/               # Data models and contexts
    └── Xbl.Xbox360/            # Xbox 360 specific support
```

## 🚀 Getting Started

### Prerequisites

- .NET 8 SDK
- Node.js 18+ and npm
- Azure Storage Account (for production image hosting)
- OpenXBL API key (for Xbox Live data access)

### Local Development Setup

1. **Clone the repositories**
```bash
git clone https://github.com/mercenaryntx/Xbl.Web
git clone https://github.com/mercenaryntx/Xbl
```

2. **Run the backend**
```bash
cd Xbl.Web/Xbl.Web
dotnet run
```

3. **Run the frontend** (separate terminal)
```bash
cd Xbl.Web/Xbl.Web/ClientApp
npm install
npm start
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Swagger UI: http://localhost:5000/swagger

## 📊 Query Mode

### Pre-defined Queries

- **Profile Summary**: Quick stats across all profiles
- **Rarest Achievements**: Your most difficult unlocks
- **Most Complete Games**: Highest completion percentages
- **Time Spent**: Games with most playtime
- **Weighted Rarity**: Games with most rare achievements
- **Categories**: Game distribution by category

### Custom KQL Queries

Query Mode supports full Kusto Query Language for advanced analytics:

**Available Tables:**
- `titles` - Game titles with progress and statistics
- `achievements` - Individual achievements with unlock status
- `stats` - Game statistics (time played)

**Example Queries:**

```kql
// Top 10 games by gamerscore
titles
| project Name, Gamerscore = CurrentGamerscore
| order by Gamerscore desc
| take 10

// Achievements under 1% rarity
achievements
| where IsUnlocked == true and RarityPercentage < 1.0
| project TitleName, Name, RarityPercentage
| order by RarityPercentage asc

// Completion rate distribution
titles
| summarize Count = count() by bin(ProgressPercentage, 10)
| order by ProgressPercentage asc
```

## 🔄 Data Updates

Data updates are handled by `Xbl.Web.Update`, a console application that:
1. Fetches latest Xbox Live data via OpenXBL API
2. Downloads game and achievement images
3. Uploads images to Azure Blob Storage
4. Updates the SQLite database

### Manual Update
```bash
Xbl.Web.Update.exe <api-key> <data-folder> <blob-connection-string>
```

### Automated Updates
The project uses Azure Pipelines for automated nightly updates:
- **CI/CD Pipeline**: Triggered on commits, deploys the web app
- **Nightly Pipeline**: Runs at midnight UTC, updates data and redeploys

See [Xbl.Web.Update/README.md](Xbl.Web.Update/README.md) for detailed information.

## 🎨 Key Components

### Backend Controllers

- **QueriesController**: Handles both pre-built and custom KQL queries
  - `GET /Queries/built-in/{queryType}` - Execute pre-defined queries
  - `POST /Queries/kusto` - Execute custom KQL queries with pagination

### Frontend Components

- **QueryMode**: Advanced query interface with KQL support
- **AchievementsList**: Searchable achievement browser
- **AchievementDetails**: Detailed view of individual achievements
- **HamburgerMenu**: Navigation and profile selection

## 🔧 Configuration

### Application Settings

**appsettings.json:**
```json
{
  "DataFolder": "data",
  "Settings": {
    "ApiKey": "your-api-key"
  }
}
```

**Environment Variables:**
- `REACT_APP_API_BASE_URL` - Backend API URL for React app

### Azure Configuration

For production deployment:
- Azure App Service for hosting
- Azure Blob Storage for images (containers: `titles`, `achievements`)
- Azure Key Vault for secrets (API keys, connection strings)
- Azure Pipelines for CI/CD

## 📦 Dependencies

### Backend
- AutoMapper
- Azure.Storage.Blobs
- Microsoft.EntityFrameworkCore.Sqlite
- KustoLoco.Core

### Frontend
- React & React Router
- Recharts for visualizations
- Custom CSS styling

## 🧪 Testing

```bash
# Backend tests
dotnet test

# Frontend tests
cd Xbl.Web/ClientApp
npm test
```

## 📝 API Documentation

When running in development mode, access Swagger UI at `/swagger` for interactive API documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

See LICENSE file for details.

## 🔗 Related Repositories

- [Xbl](https://github.com/mercenaryntx/Xbl) - Core Xbox Live client libraries
- [Xbl.Web](https://github.com/mercenaryntx/Xbl.Web) - Web application (this repo)

## 🙏 Acknowledgments

- OpenXBL for Xbox Live API access
- KustoLoco for KQL query support
- Recharts for data visualization components

---

Built with Claude Sonnet 4.5 and ❤️ for the Xbox achievement hunting community