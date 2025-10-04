import { CheckCircleOutlined, ClockCircleOutlined, LinkOutlined, WarningOutlined } from "@ant-design/icons";
import { Collapse, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { TableProps } from "antd";

const { Panel } = Collapse;

type RestaurantStatus = {
  id: string;
  name: string;
  address: string;
  expected: boolean;
  actual: boolean;
  mismatch: boolean;
  opening_hours: string;
  last_checked_at: string;
  url: string;
};

// Function to parse and format opening hours
const formatOpeningHours = (hours: string) => {
  try {
    // Try to parse as JSON (detailed hours object)
    const parsed = JSON.parse(hours);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    // If parsing fails, treat as plain text
  }

  // Return as plain text if not a valid object
  return hours;
};

// Component to display opening hours beautifully
const OpeningHoursDisplay = ({ hours }: { hours: string }) => {
  const formattedHours = formatOpeningHours(hours);

  // If it's an object with detailed hours
  if (typeof formattedHours === "object") {
    const days = Object.keys(formattedHours);

    // If no days, show as plain text
    if (days.length === 0) {
      return <Typography.Text code>{hours}</Typography.Text>;
    }

    // Get today's day name
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

    return (
      <Collapse
        bordered={false}
        size="small"
        style={{ background: "transparent" }}
        defaultActiveKey={days.includes(today) ? [today] : []}
      >
        <Panel
          header={
            <Space size="small">
              <ClockCircleOutlined />
              <span>Opening Hours</span>
              {days.includes(today) && (
                <Tag color="blue" style={{ margin: 0 }}>
                  Today: {formattedHours[today]}
                </Tag>
              )}
            </Space>
          }
          key="hours"
        >
          <div style={{ paddingLeft: "24px" }}>
            {days.map(day => (
              <div
                key={day}
                style={{
                  padding: "4px 0",
                  background: day === today ? "#e6f4ff" : "transparent",
                  borderRadius: "4px",
                  paddingLeft: "8px",
                  marginLeft: "-8px",
                }}
              >
                <Typography.Text strong style={{ width: "100px", display: "inline-block" }}>
                  {day}:
                </Typography.Text>
                <Typography.Text>
                  {formattedHours[day]}
                </Typography.Text>
              </div>
            ))}
          </div>
        </Panel>
      </Collapse>
    );
  }

  // If it's plain text
  return (
    <Tooltip title="Opening hours">
      <Typography.Text code style={{ fontSize: "12px" }}>
        {hours}
      </Typography.Text>
    </Tooltip>
  );
};

export function RestaurantTable({ data }: { data: RestaurantStatus[] }) {
  const columns: TableProps<RestaurantStatus>["columns"] = [
    {
      title: "Restaurant",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: RestaurantStatus) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{text}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: "12px" }}>
            {record.address}
          </Typography.Text>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Opening Hours",
      dataIndex: "opening_hours",
      key: "opening_hours",
      render: (text: string) => <OpeningHoursDisplay hours={text} />,
      width: 250,
    },
    {
      title: "Expected Status",
      dataIndex: "expected",
      key: "expected",
      align: "center",
      render: (value: boolean) =>
        value ? <Tag icon={<CheckCircleOutlined />} color="success">OPEN</Tag> : <Tag color="default">CLOSED</Tag>,
    },
    {
      title: "Actual Status",
      dataIndex: "actual",
      key: "actual",
      align: "center",
      render: (value: boolean) =>
        value ? <Tag icon={<CheckCircleOutlined />} color="success">OPEN</Tag> : <Tag color="default">CLOSED</Tag>,
    },
    {
      title: "Status Match",
      dataIndex: "mismatch",
      key: "mismatch",
      align: "center",
      render: (value: boolean) =>
        value
          ? (
            <Tag icon={<WarningOutlined />} color="error" style={{ fontWeight: "bold" }}>
              MISMATCH
            </Tag>
          )
          : (
            <Tag icon={<CheckCircleOutlined />} color="success">
              MATCH
            </Tag>
          ),
      sorter: (a, b) => Number(a.mismatch) - Number(b.mismatch),
    },
    {
      title: "Last Checked",
      dataIndex: "last_checked_at",
      key: "last_checked",
      render: (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
      },
      sorter: (a, b) => new Date(a.last_checked_at).getTime() - new Date(b.last_checked_at).getTime(),
      width: 180,
    },
    {
      title: "Actions",
      key: "action",
      align: "center",
      render: (_, record) => (
        <Tooltip title="View on platform">
          <a href={record.url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined />
          </a>
        </Tooltip>
      ),
      width: 100,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
      scroll={{ x: "max-content" }}
      rowClassName={(record) => record.mismatch ? "mismatch-row" : ""}
    />
  );
}
