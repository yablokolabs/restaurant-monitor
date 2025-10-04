import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ShopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Divider, Layout, Row, Spin, Statistic, Tag, Typography } from "antd";
import { RestaurantTable } from "./components/RestaurantTable";
import { useRestaurantStatus } from "./hooks/useRestaurantStatus";

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const { data, loading, error } = useRestaurantStatus();

  // Calculate statistics
  const totalRestaurants = data.length;
  const mismatchCount = data.filter(item => item.mismatch).length;
  const openCount = data.filter(item => item.actual).length;
  const closedCount = data.filter(item => !item.actual).length;

  // Debug logging
  console.log("App component render:", { data, loading, error });

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Header
        style={{
          background: "#001529",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 1,
          boxShadow: "0 2px 8px rgba(0, 21, 41, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Title
            level={3}
            style={{
              color: "white",
              margin: 0,
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            🍽️ Restaurant Availability Monitor
          </Title>
        </div>
      </Header>

      <Content style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
        {error
          ? (
            <Alert
              message="Error"
              description={`Failed to load restaurant data: ${error.message}`}
              type="error"
              showIcon
              style={{ marginBottom: "24px" }}
            />
          )
          : loading
          ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <Spin size="large" />
              <p style={{ marginTop: "16px" }}>Loading restaurant data...</p>
            </div>
          )
          : (
            <>
              {/* Statistics Cards */}
              <Row gutter={16} style={{ marginBottom: "24px" }}>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Restaurants"
                      value={totalRestaurants}
                      prefix={<ShopOutlined />}
                      valueStyle={{ color: "#1890ff" }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Open Now"
                      value={openCount}
                      valueStyle={{ color: "#52c41a" }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Closed Now"
                      value={closedCount}
                      valueStyle={{ color: "#666" }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Status Mismatches"
                      value={mismatchCount}
                      valueStyle={{ color: "#ff4d4f" }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Quick Actions and Filters */}
              <Card
                style={{
                  marginBottom: "24px",
                  borderRadius: "8px",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <Title level={4} style={{ margin: 0 }}>Restaurant Status Overview</Title>
                    <p style={{ margin: "4px 0 0 0", color: "#666" }}>
                      Monitoring {totalRestaurants} restaurants • Last updated: {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    {mismatchCount > 0 && (
                      <span
                        style={{
                          background: "#fff2f0",
                          border: "1px solid #ffccc7",
                          borderRadius: "16px",
                          padding: "4px 12px",
                          color: "#ff4d4f",
                          fontWeight: 500,
                        }}
                      >
                        ⚠️ {mismatchCount} mismatch{mismatchCount !== 1 ? "es" : ""} detected
                      </span>
                    )}
                  </div>
                </div>

                <Divider style={{ margin: "12px 0" }} />

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <strong>Legend:</strong>
                  </div>
                  <div>
                    <TagWithIcon color="success" icon={<CheckCircleOutlined />} text="Match" />
                  </div>
                  <div>
                    <TagWithIcon color="error" icon={<WarningOutlined />} text="Mismatch" />
                  </div>
                  <div>
                    <TagWithIcon color="default" text="Closed" />
                  </div>
                  <div>
                    <TagWithIcon color="success" text="Open" />
                  </div>
                </div>
              </Card>

              {/* Restaurant Table */}
              <Card
                style={{
                  background: "white",
                  borderRadius: "8px",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
                  overflow: "hidden",
                }}
              >
                <RestaurantTable data={data} />
              </Card>
            </>
          )}
      </Content>
    </Layout>
  );
}

// Helper component for legend tags
const TagWithIcon = ({ color, icon, text }: { color: string; icon?: React.ReactNode; text: string }) => (
  <Tag
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      background: color === "success" ? "#f6ffed" : color === "error" ? "#fff2f0" : "#f5f5f5",
      border: `1px solid ${color === "success" ? "#b7eb8f" : color === "error" ? "#ffa39e" : "#d9d9d9"}`,
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "12px",
    }}
  >
    {icon && <span>{icon}</span>}
    <span>{text}</span>
  </Tag>
);

export default App;
